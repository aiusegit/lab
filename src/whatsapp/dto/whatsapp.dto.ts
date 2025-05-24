import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SendMessageDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  messageText: string;
}

// Interface for WhatsAppMessage entity (matches SurrealDB table structure)
export interface WhatsAppMessage {
  id?: string; // SurrealDB record ID
  message_id: string; // From WhatsApp provider (e.g., WAMessage.key.id)
  sender_jid: string; // JID of the sender
  receiver_jid: string; // JID of the receiver (our bot or target user)
  contact_link?: string; // SurrealDB record link to contacts table, e.g., contacts:xxxx
  content: string;
  message_type: string; // "text", "image", etc.
  status: string; // "sent", "delivered", "read", "failed", "received"
  timestamp: string; // ISO datetime string or Unix timestamp from WhatsApp
  direction: 'inbound' | 'outbound';
  tenant_id: string; // Business tenant ID to associate the message
  created_at?: string; // ISO datetime string
}
