import { GET } from '@/app/api/debug/sofascore/currie-cup-seasons/route';

describe('SofaScore debug route', () => {
	it('returns sanitized season evidence from the server runtime', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					seasons: [
						{ id: 97057, name: 'Currie Cup 2026', year: '2026', editor: false },
					],
				}),
				{
					status: 200,
					headers: { 'content-type': 'application/json' },
				},
			),
		);

		const response = await GET(
			new Request('https://kudomatch.com/api/debug/sofascore/currie-cup-seasons') as any,
		);
		const json = await response.json();

		expect(response.status).toBe(200);
		expect(json.success).toBe(true);
		expect(json.upstream.status).toBe(200);
		expect(json.seasonCount).toBe(1);
		expect(json.seasons[0]).toEqual({
			id: 97057,
			name: 'Currie Cup 2026',
			year: '2026',
			editor: false,
		});
		expect(fetchSpy).toHaveBeenCalledWith(
			'https://www.sofascore.com/api/v1/unique-tournament/796/seasons',
			expect.objectContaining({
				headers: expect.objectContaining({
					accept: 'application/json',
				}),
			}),
		);
		fetchSpy.mockRestore();
	});
});
