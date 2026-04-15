import { Injectable, LoggerService } from '@nestjs/common';

interface Fields {
  [key: string]: unknown;
}

@Injectable()
export class StructuredLogger implements LoggerService {
  log(message: string, fields: Fields = {}): void {
    this.emit('info', message, fields);
  }

  info(message: string, fields: Fields = {}): void {
    this.emit('info', message, fields);
  }

  warn(message: string, fields: Fields = {}): void {
    this.emit('warn', message, fields);
  }

  error(message: string, fields: Fields = {}): void {
    this.emit('error', message, fields);
  }

  debug(message: string, fields: Fields = {}): void {
    this.emit('debug', message, fields);
  }

  verbose(message: string, fields: Fields = {}): void {
    this.emit('debug', message, fields);
  }

  private emit(level: string, msg: string, fields: Fields): void {
    const line = JSON.stringify({
      level,
      msg,
      ts: new Date().toISOString(),
      ...fields,
    });
    process.stdout.write(line + '\n');
  }
}
