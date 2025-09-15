import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { env } from "~/env";
import { Buffer } from 'buffer';

import {
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";

// Based on volcengine_binary_demo protocols
enum EventType {
  None = 0,
  StartConnection = 1,
  FinishConnection = 2,
  ConnectionStarted = 50,
  ConnectionFailed = 51,
  ConnectionFinished = 52,
  StartSession = 100,
  CancelSession = 101,
  FinishSession = 102,
  SessionStarted = 150,
  SessionCanceled = 151,
  SessionFinished = 152,
  SessionFailed = 153,
  TaskRequest = 200,
}

enum MsgType {
  Invalid = 0,
  FullClientRequest = 0b1,
  AudioOnlyClient = 0b10,
  FullServerResponse = 0b1001,
  AudioOnlyServer = 0b1011,
  FrontEndResultServer = 0b1100,
  Error = 0b1111,
}

enum MsgTypeFlagBits {
  NoSeq = 0,
  PositiveSeq = 0b1,
  LastNoSeq = 0b10,
  NegativeSeq = 0b11,
  WithEvent = 0b100,
}

enum VersionBits {
  Version1 = 1,
}

enum HeaderSizeBits {
  HeaderSize4 = 1,
}

enum SerializationBits {
  JSON = 0b1,
}

enum CompressionBits {
  None = 0,
}

interface Message {
  version: VersionBits;
  headerSize: HeaderSizeBits;
  type: MsgType;
  flag: MsgTypeFlagBits;
  serialization: SerializationBits;
  compression: CompressionBits;
  event?: EventType;
  sessionId?: string;
  connectId?: string;
  sequence?: number;
  errorCode?: number;
  payload: Uint8Array;
}

function createMessage(msgType: MsgType, flag: MsgTypeFlagBits): Message {
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

function marshalMessage(msg: Message): Uint8Array {
  const buffers: Uint8Array[] = [];

  // Build base header
  const headerSize = 4 * msg.headerSize;
  const header = new Uint8Array(headerSize);

  header[0] = (msg.version << 4) | msg.headerSize;
  header[1] = (msg.type << 4) | msg.flag;
  header[2] = (msg.serialization << 4) | msg.compression;

  buffers.push(header);

  // Write fields based on message type and flags
  if (msg.flag === MsgTypeFlagBits.WithEvent) {
    // Write event
    if (msg.event !== undefined) {
      const buffer = new ArrayBuffer(4);
      const view = new DataView(buffer);
      view.setInt32(0, msg.event, false);
      buffers.push(new Uint8Array(buffer));
    }

    // Write sessionId for non-connection events
    if (msg.event !== undefined && 
        msg.event !== EventType.StartConnection && 
        msg.event !== EventType.FinishConnection &&
        msg.event !== EventType.ConnectionStarted &&
        msg.event !== EventType.ConnectionFailed) {
      const sessionId = msg.sessionId || '';
      const sessionIdBytes = Buffer.from(sessionId, 'utf8');
      const sizeBuffer = new ArrayBuffer(4);
      const sizeView = new DataView(sizeBuffer);
      sizeView.setUint32(0, sessionIdBytes.length, false);

      const result = new Uint8Array(4 + sessionIdBytes.length);
      result.set(new Uint8Array(sizeBuffer), 0);
      result.set(sessionIdBytes, 4);
      buffers.push(result);
    }
  }

  // Write sequence if needed
  if (msg.flag === MsgTypeFlagBits.PositiveSeq || msg.flag === MsgTypeFlagBits.NegativeSeq) {
    if (msg.sequence !== undefined) {
      const buffer = new ArrayBuffer(4);
      const view = new DataView(buffer);
      view.setInt32(0, msg.sequence, false);
      buffers.push(new Uint8Array(buffer));
    }
  }

  // Write error code if needed
  if (msg.type === MsgType.Error && msg.errorCode !== undefined) {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint32(0, msg.errorCode, false);
    buffers.push(new Uint8Array(buffer));
  }

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

function unmarshalMessage(data: Uint8Array): Message {
  if (data.length < 3) {
    throw new Error(`data too short: expected at least 3 bytes, got ${data.length}`);
  }

  let offset = 0;

  // Read base header with proper bounds checking
  if (offset >= data.length) throw new Error('insufficient data for version and header size');
  const versionAndHeaderSize = data[offset++]!;
  
  if (offset >= data.length) throw new Error('insufficient data for type and flag');
  const typeAndFlag = data[offset++]!;
  
  if (offset >= data.length) throw new Error('insufficient data for serialization and compression');
  const serializationAndCompression = data[offset++]!;

  const msg: Message = {
    version: (versionAndHeaderSize >> 4) as VersionBits,
    headerSize: (versionAndHeaderSize & 0b00001111) as HeaderSizeBits,
    type: (typeAndFlag >> 4) as MsgType,
    flag: (typeAndFlag & 0b00001111) as MsgTypeFlagBits,
    serialization: (serializationAndCompression >> 4) as SerializationBits,
    compression: (serializationAndCompression & 0b00001111) as CompressionBits,
    payload: new Uint8Array(0),
  };

  // Skip remaining header bytes
  offset = 4 * msg.headerSize;

  // Read sequence if needed
  if (msg.flag === MsgTypeFlagBits.PositiveSeq || msg.flag === MsgTypeFlagBits.NegativeSeq) {
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

  // Read event and sessionId if needed
  if (msg.flag === MsgTypeFlagBits.WithEvent) {
    // Read event
    if (offset + 4 > data.length) {
      throw new Error('insufficient data for event');
    }
    const view = new DataView(data.buffer, data.byteOffset + offset, 4);
    msg.event = view.getInt32(0, false);
    offset += 4;

    // Read sessionId for non-connection events
    if (msg.event !== EventType.StartConnection && 
        msg.event !== EventType.FinishConnection &&
        msg.event !== EventType.ConnectionStarted &&
        msg.event !== EventType.ConnectionFailed &&
        msg.event !== EventType.ConnectionFinished) {
      
      if (offset + 4 > data.length) {
        throw new Error('insufficient data for session ID size');
      }
      const sizeView = new DataView(data.buffer, data.byteOffset + offset, 4);
      const size = sizeView.getUint32(0, false);
      offset += 4;

      if (size > 0) {
        if (offset + size > data.length) {
          throw new Error('insufficient data for session ID');
        }
        msg.sessionId = new TextDecoder().decode(data.slice(offset, offset + size));
        offset += size;
      }
    }

    // Read connectId for connection events
    if (msg.event === EventType.ConnectionStarted ||
        msg.event === EventType.ConnectionFailed ||
        msg.event === EventType.ConnectionFinished) {
      
      if (offset + 4 > data.length) {
        throw new Error('insufficient data for connect ID size');
      }
      const sizeView = new DataView(data.buffer, data.byteOffset + offset, 4);
      const size = sizeView.getUint32(0, false);
      offset += 4;

      if (size > 0) {
        if (offset + size > data.length) {
          throw new Error('insufficient data for connect ID');
        }
        msg.connectId = new TextDecoder().decode(data.slice(offset, offset + size));
        offset += size;
      }
    }
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

function voiceToCluster(voice: string): string {
  if (voice.startsWith('S_')) {
    return 'volcano_icl';
  }
  return 'volcano_tts';
}

// Exact replication of volcengine_binary_demo approach
async function FullClientRequest(ws: any, payload: Uint8Array): Promise<void> {
  const msg = createMessage(MsgType.FullClientRequest, MsgTypeFlagBits.NoSeq);
  msg.payload = payload;
  console.log(`Sending FullClientRequest: PayloadSize=${msg.payload.length}`);
  const data = marshalMessage(msg);
  return new Promise((resolve, reject) => {
    ws.send(data, (error?: Error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function ReceiveMessage(ws: any): Promise<Message> {
  return new Promise((resolve, reject) => {
    const messageHandler = (data: Buffer) => {
      try {
        const uint8Data = new Uint8Array(data);
        const msg = unmarshalMessage(uint8Data);
        ws.removeListener('message', messageHandler);
        ws.removeListener('error', errorHandler);
        resolve(msg);
      } catch (error) {
        ws.removeListener('message', messageHandler);
        ws.removeListener('error', errorHandler);
        reject(error);
      }
    };

    const errorHandler = (error: Error) => {
      ws.removeListener('message', messageHandler);
      ws.removeListener('error', errorHandler);
      reject(error);
    };

    ws.once('message', messageHandler);
    ws.once('error', errorHandler);
  });
}

class VolcanoTTSClient {
  async synthesize(text: string, voiceType: string = "zh_male_beijingxiaoye_emo_v2_mars_bigtts"): Promise<string> {
    return new Promise((resolve, reject) => {
      const WebSocket = require('ws');
      
      const ws = new WebSocket('wss://openspeech.bytedance.com/api/v1/tts/ws_binary', {
        headers: {
          'Authorization': `Bearer;${env.VOLCANO_TTS_ACCESS_TOKEN}`,
        },
        skipUTF8Validation: true,
      });

      ws.on('open', async () => {
        try {
          console.log('WebSocket connected');
          
          const request = {
            app: {
              appid: env.VOLCANO_TTS_APP_ID,
              token: env.VOLCANO_TTS_ACCESS_TOKEN,
              cluster: voiceToCluster(voiceType),
            },
            user: {
              uid: uuidv4(),
            },
            audio: {
              voice_type: voiceType,
              encoding: 'wav',
            },
            request: {
              reqid: uuidv4(),
              text: text,
              operation: 'submit',
              extra_param: JSON.stringify({
                disable_markdown_filter: false,
              }),
              with_timestamp: '1',
            },
          };

          await FullClientRequest(ws, new TextEncoder().encode(JSON.stringify(request)));

          const audioChunks: Uint8Array[] = [];

          while (true) {
            const msg = await ReceiveMessage(ws);
            console.log(`Received: MsgType=${msg.type}, Sequence=${msg.sequence}, PayloadSize=${msg.payload.length}`);

            switch (msg.type) {
              case MsgType.FrontEndResultServer:
                // JSON response
                const jsonStr = new TextDecoder().decode(msg.payload);
                console.log('Frontend result:', jsonStr);
                break;

              case MsgType.AudioOnlyServer:
                audioChunks.push(msg.payload);
                console.log(`Audio chunk: ${msg.payload.length} bytes`);
                break;

              case MsgType.Error:
                const errorMsg = new TextDecoder().decode(msg.payload);
                throw new Error(`TTS API Error ${msg.errorCode}: ${errorMsg}`);

              default:
                throw new Error(`Unexpected message type: ${msg.type}`);
            }

            if (msg.type === MsgType.AudioOnlyServer && 
                msg.sequence !== undefined && 
                msg.sequence < 0) {
              break;
            }
          }

          if (audioChunks.length === 0) {
            throw new Error('No audio received');
          }

          // Combine audio chunks
          const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
          const combinedAudio = new Uint8Array(totalLength);
          let offset = 0;
          
          for (const chunk of audioChunks) {
            combinedAudio.set(chunk, offset);
            offset += chunk.length;
          }

          const base64Audio = Buffer.from(combinedAudio).toString('base64');
          console.log(`Audio synthesis complete: ${combinedAudio.length} bytes`);
          
          ws.close();
          resolve(base64Audio);

        } catch (error) {
          console.error('TTS synthesis error:', error);
          ws.close();
          reject(error);
        }
      });

      ws.on('error', (error: Error) => {
        console.error('WebSocket error:', error);
        reject(error);
      });

      ws.on('close', () => {
        console.log('WebSocket closed');
      });
    });
  }
}

export const speechRouter = createTRPCRouter({
  synthesize: publicProcedure
    .input(z.object({ 
      text: z.string().min(1).max(300, "Text too long. Maximum 300 characters."),
      voiceType: z.string().optional()
    }))
    .mutation(async ({ input }) => {
      try {
        const client = new VolcanoTTSClient();
        const audioBase64 = await client.synthesize(input.text, input.voiceType);
        
        return {
          success: true,
          audioBase64,
          text: input.text,
          voiceType: input.voiceType || "zh_male_beijingxiaoye_emo_v2_mars_bigtts"
        };
      } catch (error) {
        console.error('Speech synthesis error:', error);
        throw new Error(`Speech synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }),

  getVoiceTypes: publicProcedure
    .query(() => {
      return [
        {
          id: "zh_male_beijingxiaoye_emo_v2_mars_bigtts",
          name: "北京小爷 (多情感男声)",
          language: "中文",
          description: "多情感支持的男性声音"
        },
        {
          id: "zh_female_roumeinvyou_emo_v2_mars_bigtts", 
          name: "柔美女友 (多情感女声)",
          language: "中文",
          description: "多情感支持的女性声音"
        },
        {
          id: "zh_female_shuangkuaisisi_emo_v2_mars_bigtts",
          name: "爽快思思 (中英双语)",
          language: "中文、美式英语", 
          description: "支持中英双语的女性声音"
        }
      ];
    })
});
