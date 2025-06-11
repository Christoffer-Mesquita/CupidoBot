import chalk from 'chalk';
import moment from 'moment';

export class Logger {
    static timestamp(): string {
        return moment().format('YYYY-MM-DD HH:mm:ss');
    }

    static info(message: string): void {
        console.log(chalk.magenta(`[${this.timestamp()}] ${chalk.red('♥')} ${message}`));
    }

    static success(message: string): void {
        console.log(chalk.red(`[${this.timestamp()}] ${chalk.magenta('💘')} ${message}`));
    }

    static error(message: string): void {
        console.log(chalk.red(`[${this.timestamp()}] ${chalk.magenta('💔')} ${message}`));
    }

    static warning(message: string): void {
        console.log(chalk.yellow(`[${this.timestamp()}] ${chalk.red('💝')} ${message}`));
    }

    static database(message: string): void {
        console.log(chalk.cyan(`[${this.timestamp()}] ${chalk.blue('🗄️')} ${message}`));
    }
} 