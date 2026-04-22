import chalk from 'chalk';

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  HTTP = 2,
  SUCCESS = 3,
  WARN = 4,
  ERROR = 5,
}

const LOG_LEVEL_MAP: Record<string, LogLevel> = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  http: LogLevel.HTTP,
  success: LogLevel.SUCCESS,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
};

const currentLogLevel = LOG_LEVEL_MAP[process.env.LOG_LEVEL?.toLowerCase() || 'info'] ?? LogLevel.INFO;

export const colorizeStatus = (status: number) => {
  if (status >= 500) return chalk.red(status);
  if (status >= 400) return chalk.yellow(status);
  if (status >= 300) return chalk.cyan(status);
  if (status >= 200) return chalk.green(status);
  return chalk.white(status);
};

export const colorizeMethod = (method: string) => {
  switch (method.toUpperCase()) {
    case 'GET':
      return chalk.green(method);
    case 'POST':
      return chalk.blue(method);
    case 'PUT':
      return chalk.yellow(method);
    case 'DELETE':
      return chalk.red(method);
    case 'PATCH':
      return chalk.magenta(method);
    default:
      return chalk.white(method);
  }
};

class Logger {
  private getTimestamp() {
    return new Date().toISOString();
  }

  private formatValue(value: any) {
    if (typeof value === 'object' && value !== null) {
      try {
        return '\n' + JSON.stringify(value, null, 2);
      } catch {
        return value;
      }
    }
    return value;
  }

  private formatMessage(level: string, message: string, tag?: string) {
    const timestamp = chalk.gray(`[${this.getTimestamp()}]`);
    const tagPart = tag ? chalk.cyan(`[${tag}]`) : '';
    return `${timestamp} ${level} ${tagPart} ${message}`;
  }

  debug(message: string, tag?: string, ...args: any[]) {
    if (currentLogLevel <= LogLevel.DEBUG) {
      const formattedArgs = args.map((arg) => this.formatValue(arg));
      console.log(this.formatMessage(chalk.magenta('DEBUG  '), message, tag), ...formattedArgs);
    }
  }

  info(message: string, tag?: string, ...args: any[]) {
    if (currentLogLevel <= LogLevel.INFO) {
      const formattedArgs = args.map((arg) => this.formatValue(arg));
      console.log(this.formatMessage(chalk.blue('INFO   '), message, tag), ...formattedArgs);
    }
  }

  http(message: string, tag?: string, ...args: any[]) {
    if (currentLogLevel <= LogLevel.HTTP) {
      const formattedArgs = args.map((arg) => this.formatValue(arg));
      console.log(this.formatMessage(chalk.cyan('HTTP   '), message, tag), ...formattedArgs);
    }
  }

  success(message: string, tag?: string, ...args: any[]) {
    if (currentLogLevel <= LogLevel.SUCCESS) {
      const formattedArgs = args.map((arg) => this.formatValue(arg));
      console.log(this.formatMessage(chalk.green('SUCCESS'), message, tag), ...formattedArgs);
    }
  }

  warn(message: string, tag?: string, ...args: any[]) {
    if (currentLogLevel <= LogLevel.WARN) {
      const formattedArgs = args.map((arg) => this.formatValue(arg));
      console.warn(this.formatMessage(chalk.yellow('WARN   '), message, tag), ...formattedArgs);
    }
  }

  error(message: string, tag?: string, error?: any) {
    if (currentLogLevel <= LogLevel.ERROR) {
      console.error(this.formatMessage(chalk.red('ERROR  '), message, tag));
      if (error) {
        if (error.stack) {
          console.error(chalk.red(error.stack));
        } else {
          console.error(chalk.red(this.formatValue(error)));
        }
      }
    }
  }
}

export const logger = new Logger();
