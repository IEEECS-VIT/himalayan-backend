export class TwilioError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'TwilioError';
  }
} 