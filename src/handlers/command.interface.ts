import { Client, Message } from 'whatsapp-web.js';

export interface ICommand {
    name: string; // O nome do comando, ex: 'ajuda'
    description: string; // Uma breve descrição do comando
    aliases?: string[]; // Opcional: para suportar apelidos de comando
    execute: (client: Client, message: Message, args: string[]) => Promise<void>;
}
