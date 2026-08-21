// Set up env variables before any imports
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
process.env.RAPIDAPI_KEY = 'mock-rapid-key';
process.env.FOOTBALL_DATA_API_KEY = 'mock-football-key';

// Mock Supabase JS client
const mockInsert = vi.fn().mockReturnThis();
const mockSelect = vi.fn().mockReturnThis();
const mockSingle = vi.fn().mockReturnThis();
const mockUpsert = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();

const mockSupabaseAdmin = {
	from: vi.fn(() => ({
		select: mockSelect,
		insert: mockInsert,
		upsert: mockUpsert,
		single: mockSingle,
		eq: mockEq,
	})),
	rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
};

vi.mock('@supabase/supabase-js', () => ({
	createClient: vi.fn(() => mockSupabaseAdmin),
}));

describe('scripts automation and seeding', () => {
	let originalArgv: string[];
	let exitSpy: any;

	beforeEach(() => {
		vi.clearAllMocks();
		originalArgv = process.argv;
		exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
			throw new Error('process.exit called');
		});

		// Stub global fetch to prevent actual requests
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve([]),
			text: () => Promise.resolve('[]'),
			headers: {
				get: () => 'application/json',
			},
		} as any);

		// Clear module cache so scripts run again for each test
		vi.resetModules();
	});

	afterEach(() => {
		process.argv = originalArgv;
		exitSpy.mockRestore();
	});

	describe('score-match.ts', () => {
		it('executes simulation mode when --simulate is passed', async () => {
			process.argv = [
				'node',
				'scripts/score-match.ts',
				'--simulate',
				'--matchday=12',
			];
			mockSelect.mockResolvedValueOnce({
				data: [
					{
						id: 'match-1',
						status: 'scheduled',
						home_team: { name: 'Arsenal' },
						away_team: { name: 'Chelsea' },
					},
				],
				error: null,
			});
			mockUpsert.mockResolvedValueOnce({ data: [], error: null });

			try {
				await import('@/scripts/score-match');
			} catch (err: any) {
				expect(err.message).toBe('process.exit called');
			}
			expect(mockSelect).toHaveBeenCalled();
		});

		it('executes recalculation mode when --recalc is passed', async () => {
			process.argv = ['node', 'scripts/score-match.ts', '--recalc'];

			try {
				await import('@/scripts/score-match');
			} catch (err: any) {
				expect(err.message).toBe('process.exit called');
			}
			expect(mockSupabaseAdmin.rpc).toHaveBeenCalledWith(
				'recalculate_all_scores',
			);
		});

		it('executes resolution mode when --resolve is passed', async () => {
			process.argv = [
				'node',
				'scripts/score-match.ts',
				'--resolve',
				'--matchId=11111111-1111-4111-a111-111111111111',
				'--homeScore=2',
				'--awayScore=1',
			];
			mockSelect.mockResolvedValueOnce({
				data: {
					id: '11111111-1111-4111-a111-111111111111',
					home_team: { name: 'Arsenal' },
					away_team: { name: 'Chelsea' },
				},
				error: null,
			});
			mockUpsert.mockResolvedValueOnce({ data: [], error: null });

			try {
				await import('@/scripts/score-match');
			} catch (err: any) {
				expect(err.message).toBe('process.exit called');
			}
			expect(mockSelect).toHaveBeenCalled();
		});
	});

	describe('seed-fixtures.ts', () => {
		it('runs seeding successfully with fallbacks when fetching fails', async () => {
			process.argv = ['node', 'scripts/seed-fixtures.ts'];
			mockSelect.mockResolvedValue({ data: [], error: null });
			mockInsert.mockResolvedValue({ data: [], error: null });
			mockUpsert.mockResolvedValue({ data: [], error: null });

			try {
				await import('@/scripts/seed-fixtures');
			} catch (err: any) {
				expect(err.message).toBe('process.exit called');
			}
			expect(mockInsert).toHaveBeenCalled();
		});
	});

	describe('seed-historic-data.ts', () => {
		it('runs historic seeder successfully', async () => {
			process.argv = ['node', 'scripts/seed-historic-data.ts'];
			mockSelect.mockResolvedValue({ data: [], error: null });
			mockInsert.mockResolvedValue({ data: [], error: null });
			mockUpsert.mockResolvedValue({ data: [], error: null });

			try {
				await import('@/scripts/seed-historic-data');
			} catch (err: any) {
				expect(err.message).toBe('process.exit called');
			}
			expect(mockInsert).toHaveBeenCalled();
		});
	});

	describe('fetch-live-scores.ts', () => {
		it('executes live score synchronization on matches in need of updates', async () => {
			const { fetchLiveScores } = await import('@/scripts/fetch-live-scores');
			mockSelect.mockResolvedValueOnce({
				data: [
					{
						id: 'match-1',
						external_id: 12001,
						status: 'scheduled',
						home_score: null,
						away_score: null,
						home_team: { name: 'Arsenal' },
						away_team: { name: 'Chelsea' },
					},
				],
				error: null,
			});
			mockUpsert.mockResolvedValue({ data: [], error: null });

			const result = await fetchLiveScores({ simulate: true });
			expect(result.success).toBe(true);
			expect(mockSelect).toHaveBeenCalled();
		});
	});

	describe('db-backup.ts', () => {
		it('safely runs the backup and restore database operations', async () => {
			const { backupDatabase, restoreDatabase } =
				await import('@/scripts/db-backup');
			mockSelect.mockResolvedValue({ data: [], error: null });
			mockUpsert.mockResolvedValue({ data: [], error: null });

			const tempBackupFile = 'backups/test_backup_temp.json';
			const backupRes = await backupDatabase(tempBackupFile);
			expect(backupRes.success).toBe(true);

			const restoreRes = await restoreDatabase(tempBackupFile);
			expect(restoreRes.success).toBe(true);

			// Clean up temp test backup file
			const fs = await import('fs');
			if (fs.existsSync(tempBackupFile)) {
				fs.unlinkSync(tempBackupFile);
			}
		});
	});
});
