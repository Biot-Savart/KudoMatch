import { redactPayload } from '@/scripts/prove-rugby-multi-provider';

describe('multi-provider proof redaction', () => {
	it('redacts credential-like keys and values without changing ordinary evidence', () => {
		const result = redactPayload({
			status: 'ok',
			apiKey: 'should-not-be-stored',
			nested: { authorization: 'Bearer secret-value' },
			message: 'ordinary provider response',
		});

		expect(result).toEqual({
			status: 'ok',
			apiKey: '[REDACTED]',
			nested: { authorization: '[REDACTED]' },
			message: 'ordinary provider response',
		});
	});
});
