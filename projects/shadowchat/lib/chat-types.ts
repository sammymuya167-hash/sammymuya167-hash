export type Member = { id: string; handle: string; name: string; publicKey: string; role: "owner" | "member"; status: "active" | "revoked" };
export type Envelope = { id: string; conversationId: string; nonce: string; ciphertext: string };
export type Message = Envelope & { seq: number; senderId: string; createdAt: number };
export type Conversation = { id: string; peer: Member; createdAt: number; updatedAt: number; unread: number; peerReadSeq: number; peerDeliveredSeq: number; last: Message | null };
export type Invitation = { id: string; email: string; createdAt: number; expiresAt: number; claimed: boolean; revoked: boolean };
export type Bootstrap = { user: { id: string; name: string; email: string }; member: Member | null; initialized: boolean; release: string };
export type PlainMessage = { v: 1; id: string; conversationId: string; senderId: string; recipientId: string; text: string };
export const RELEASE = "0.1.0";
