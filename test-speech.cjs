// Test script for speech synthesis
const WebSocket = require('ws');

// Test configuration
const VOLCANO_TTS_APP_ID = "1450310387";
const VOLCANO_TTS_ACCESS_TOKEN = "fnvu0A8uDlbBdbrJ9_FlEe29mmuYHNZd";

// Message types
const MsgType = {
  FullClientRequest: 0b1,
  FrontEndResultServer: 0b1100,
  AudioOnlyServer: 0b1011,
  Error: 0b1111,
};

const MsgTypeFlagBits = {
  NoSeq: 0,
};

const VersionBits = {
  Version1: 1,
};

const HeaderSizeBits = {
  HeaderSize4: 1,
};

const SerializationBits = {
  JSON: 0b1,
};

const CompressionBits = {
  None: 0,
};

function createMessage(msgType, flag) {
  return {
    type: msgType,
    flag: flag,
    version: VersionBits.Version1,
    headerSize: HeaderSizeBits.HeaderSize4,
    serialization: SerializationBits.JSON,
    compression: CompressionBits.None,
    payload: new Uint8Array(0),
  };
}

function marshalMessage(msg) {
  const buffers = [];

  // Build base header
  const headerSize = 4 * msg.headerSize;
  const header = new Uint8Array(headerSize);

  header[0] = (msg.version << 4) | msg.headerSize;
  header[1] = (msg.type << 4) | msg.flag;
  header[2] = (msg.serialization << 4) | msg.compression;

  buffers.push(header);

  // Write payload
  const payloadSize = msg.payload.length;
  const sizeBuffer = new ArrayBuffer(4);
  const sizeView = new DataView(sizeBuffer);
  sizeView.setUint32(0, payloadSize, false);

  const payloadWithSize = new Uint8Array(4 + payloadSize);
  payloadWithSize.set(new Uint8Array(sizeBuffer), 0);
  payloadWithSize.set(msg.payload, 4);
  buffers.push(payloadWithSize);

  // Merge all buffers
  const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const buf of buffers) {
    result.set(buf, offset);
    offset += buf.length;
  }

  return result;
}

function unmarshalMessage(data) {
  if (data.length < 3) {
    throw new Error(`data too short: expected at least 3 bytes, got ${data.length}`);
  }

  let offset = 0;

  const versionAndHeaderSize = data[offset++];
  const typeAndFlag = data[offset++];
  const serializationAndCompression = data[offset++];

  const msg = {
    version: (versionAndHeaderSize >> 4),
    headerSize: (versionAndHeaderSize & 0b00001111),
    type: (typeAndFlag >> 4),
    flag: (typeAndFlag & 0b00001111),
    serialization: (serializationAndCompression >> 4),
    compression: (serializationAndCompression & 0b00001111),
    payload: new Uint8Array(0),
  };

  // Skip remaining header bytes
  offset = 4 * msg.headerSize;

  // Read sequence if needed
  if (msg.flag === 0b1 || msg.flag === 0b11) { // PositiveSeq or NegativeSeq
    if (offset + 4 > data.length) {
      throw new Error('insufficient data for sequence');
    }
    const view = new DataView(data.buffer, data.byteOffset + offset, 4);
    msg.sequence = view.getInt32(0, false);
    offset += 4;
  }

  // Read error code if needed
  if (msg.type === MsgType.Error) {
    if (offset + 4 > data.length) {
      throw new Error('insufficient data for error code');
    }
    const view = new DataView(data.buffer, data.byteOffset + offset, 4);
    msg.errorCode = view.getUint32(0, false);
    offset += 4;
  }

  // Read payload
  if (offset + 4 > data.length) {
    throw new Error('insufficient data for payload size');
  }
  const payloadSizeView = new DataView(data.buffer, data.byteOffset + offset, 4);
  const payloadSize = payloadSizeView.getUint32(0, false);
  offset += 4;

  if (payloadSize > 0) {
    if (offset + payloadSize > data.length) {
      throw new Error('insufficient data for payload');
    }
    msg.payload = data.slice(offset, offset + payloadSize);
  }

  return msg;
}

async function testSpeechSynthesis() {
  return new Promise((resolve, reject) => {
    console.log('Starting speech synthesis test...');
    
    const ws = new WebSocket('wss://openspeech.bytedance.com/api/v1/tts/ws_binary', {
      headers: {
        'Authorization': `Bearer;${VOLCANO_TTS_ACCESS_TOKEN}`,
      },
      skipUTF8Validation: true,
    });

    const audioChunks = [];

    ws.on('open', async () => {
      try {
        console.log('WebSocket connected');
        
        const request = {
          app: {
            appid: VOLCANO_TTS_APP_ID,
            token: VOLCANO_TTS_ACCESS_TOKEN,
            cluster: "volcano_tts",
          },
          user: {
            uid: "test-user-12345",
          },
          audio: {
            voice_type: "zh_male_beijingxiaoye_emo_v2_mars_bigtts",
            encoding: 'wav',
          },
          request: {
            reqid: "test-req-12345",
            text: "你好，这是语音合成测试。",
            operation: 'submit',
            extra_param: JSON.stringify({
              disable_markdown_filter: false,
            }),
            with_timestamp: '1',
          },
        };

        const msg = createMessage(MsgType.FullClientRequest, MsgTypeFlagBits.NoSeq);
        msg.payload = Buffer.from(JSON.stringify(request), 'utf-8');
        
        const data = marshalMessage(msg);
        console.log(`Sending request: PayloadSize=${msg.payload.length}`);
        ws.send(data);
        
      } catch (error) {
        console.error('Error sending request:', error);
        reject(error);
      }
    });

    ws.on('message', (data) => {
      try {
        const uint8Data = new Uint8Array(data);
        const msg = unmarshalMessage(uint8Data);
        
        console.log(`Received: MsgType=${msg.type}, Sequence=${msg.sequence}, PayloadSize=${msg.payload.length}`);

        switch (msg.type) {
          case MsgType.FrontEndResultServer:
            const jsonStr = Buffer.from(msg.payload).toString('utf-8');
            console.log('Frontend result:', jsonStr);
            break;

          case MsgType.AudioOnlyServer:
            audioChunks.push(msg.payload);
            console.log(`Audio chunk: ${msg.payload.length} bytes`);
            
            // Check if this is the last chunk (negative sequence)
            if (msg.sequence !== undefined && msg.sequence < 0) {
              console.log('Received last audio chunk, finishing...');
              
              if (audioChunks.length === 0) {
                reject(new Error('No audio received'));
                return;
              }

              // Combine audio chunks
              const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
              console.log(`Total audio size: ${totalLength} bytes`);
              
              ws.close();
              resolve({ success: true, audioSize: totalLength });
            }
            break;

          case MsgType.Error:
            const errorMsg = Buffer.from(msg.payload).toString('utf-8');
            console.error(`TTS API Error ${msg.errorCode}: ${errorMsg}`);
            reject(new Error(`TTS API Error ${msg.errorCode}: ${errorMsg}`));
            break;

          default:
            console.log(`Unhandled message type: ${msg.type}`);
        }

      } catch (error) {
        console.error('Error processing message:', error);
        reject(error);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      reject(error);
    });

    ws.on('close', () => {
      console.log('WebSocket closed');
    });

    // Set timeout
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        console.log('Test timeout, closing connection');
        ws.close();
        if (audioChunks.length > 0) {
          const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
          resolve({ success: true, audioSize: totalLength });
        } else {
          reject(new Error('Test timeout - no audio received'));
        }
      }
    }, 15000); // 15 second timeout
  });
}

// Run the test
testSpeechSynthesis()
  .then(result => {
    console.log('✅ Speech synthesis test successful!', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Speech synthesis test failed:', error.message);
    process.exit(1);
  });
