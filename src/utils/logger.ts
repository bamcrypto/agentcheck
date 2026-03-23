type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function formatTimestamp(): string {
  return new Date().toISOString();
}

function log(level: LogLevel, component: string, message: string, data?: unknown): void {
  if (LOG_LEVELS[level] < LOG_LEVELS[currentLevel]) return;

  const prefix = `[${formatTimestamp()}] [${level.toUpperCase()}] [${component}]`;
  if (data !== undefined) {
    console.log(`${prefix} ${message}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

export function createLogger(component: string) {
  return {
    debug: (msg: string, data?: unknown) => log('debug', component, msg, data),
    info: (msg: string, data?: unknown) => log('info', component, msg, data),
    warn: (msg: string, data?: unknown) => log('warn', component, msg, data),
    error: (msg: string, data?: unknown) => log('error', component, msg, data),
  };
}

// Telegram alert support (optional)
export async function sendTelegramAlert(message: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;

  try {
    const { default: axios } = await import('axios');
    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text: `🔔 Thesis Alert\n${message}`,
      parse_mode: 'Markdown',
    });
  } catch {
    console.error('Failed to send Telegram alert');
  }
}
