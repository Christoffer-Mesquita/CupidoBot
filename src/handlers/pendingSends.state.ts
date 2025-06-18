import { Message } from 'whatsapp-web.js';

export interface PendingSendDetails {
    targetNumber: string;
    messageType: string;
    messageContent: string;
    timestamp: number;
    originalMessage: Message; // Para poder responder ao usuário que iniciou o envio
}

// Este Map armazenará as solicitações de envio pendentes de confirmação.
// A chave será o ID serializado do usuário que enviou o comando 'cupido enviar'.
export const pendingSends = new Map<string, PendingSendDetails>();
