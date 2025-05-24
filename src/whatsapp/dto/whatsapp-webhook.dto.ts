import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean } from 'class-validator';
import { WAMessage } from '@whiskeysockets/baileys'; // For the content field type

// This DTO should match the payload sent by the Baileys microservice's webhook
export class IncomingMessagePayload {
  @IsString()
  @IsNotEmpty()
  messageId: string;

  @IsString()
  @IsNotEmpty()
  senderJid: string;

  @IsString()
  @IsOptional()
  participantJid?: string; // For group messages

  @IsNumber()
  @IsNotEmpty()
  messageTimestamp: number; // Unix timestamp

  @IsString()
  @IsOptional()
  pushName?: string;

  // The 'content' field will be the raw Baileys WAMessage object.
  // Validation for such a complex object within a DTO is tricky and often not fully done.
  // We'll accept it as an object and the service will parse it.
  @IsNotEmpty()
  content: WAMessage['message']; // This is the proto.IMessage part of WAMessage

  // Additional fields can be added if the Baileys microservice sends more, e.g.:
  // @IsBoolean()
  // @IsOptional()
  // isMedia?: boolean;

  // @IsString()
  // @IsOptional()
  // mediaType?: string;
}

// For storing in DB (already exists in whatsapp.dto.ts, but shown for context)
// export interface WhatsAppMessage {
//   id?: string;
//   message_id: string;
//   sender_jid: string;
//   receiver_jid: string; // Our bot's JID
//   contact_link?: string;
//   content: string; // Extracted text content
//   message_type: string;
//   status: string;
//   timestamp: string; // ISO
//   direction: 'inbound' | 'outbound';
//   tenant_id: string;
//   created_at?: string;
// }
