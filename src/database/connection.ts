import mongoose from 'mongoose';
import { Logger } from '../utils/logger';

export class DatabaseConnection {
    private static instance: DatabaseConnection;
    private isConnected: boolean = false;
    private readonly uri: string = 'mongodb://localhost:27017/cupidbot';

    private constructor() {}

    public static getInstance(): DatabaseConnection {
        if (!DatabaseConnection.instance) {
            DatabaseConnection.instance = new DatabaseConnection();
        }
        return DatabaseConnection.instance;
    }

    public async connect(): Promise<void> {
        if (this.isConnected) {
            Logger.info('Reutilizando conexão existente com o banco de dados 💫');
            return;
        }

        try {
            Logger.info('Iniciando conexão com o banco de dados... 🔄');
            
            await mongoose.connect(this.uri, {
                serverSelectionTimeoutMS: 5000,
            });

            this.isConnected = true;
            Logger.success('Conexão com o banco de dados estabelecida com sucesso! 🎯');
            
            // Setup connection event handlers
            mongoose.connection.on('error', (error) => {
                Logger.error(`Erro na conexão com o banco de dados: ${error}`);
                this.isConnected = false;
            });

            mongoose.connection.on('disconnected', () => {
                Logger.warning('Conexão com o banco de dados perdida! Tentando reconectar... 💔');
                this.isConnected = false;
                this.reconnect();
            });

        } catch (error) {
            Logger.error(`Falha ao conectar com o banco de dados: ${error}`);
            throw error;
        }
    }

    private async reconnect(): Promise<void> {
        try {
            await this.connect();
        } catch (error) {
            Logger.error('Falha na tentativa de reconexão');
            setTimeout(() => this.reconnect(), 5000);
        }
    }

    public async disconnect(): Promise<void> {
        if (!this.isConnected) return;

        try {
            await mongoose.disconnect();
            this.isConnected = false;
            Logger.warning('Conexão com o banco de dados encerrada 💤');
        } catch (error) {
            Logger.error(`Erro ao desconectar do banco de dados: ${error}`);
            throw error;
        }
    }

    public getConnection(): mongoose.Connection {
        return mongoose.connection;
    }

    public async checkConnection(): Promise<boolean> {
        return this.isConnected && mongoose.connection.readyState === 1;
    }
} 