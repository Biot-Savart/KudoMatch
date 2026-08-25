import { evaluatePrediction, ScorelinePayload } from '@/lib/scoring/evaluator';
import scoringCases from '@/tests/contracts/scoring-cases.json';

describe('Scoring Engine Contract Parity Tests', () => {
	it('matches all test vectors in tests/contracts/scoring-cases.json', () => {
		for (const testCase of scoringCases) {
			const evaluated = evaluatePrediction(
				testCase.evaluator_key,
				{},
				testCase.selection as ScorelinePayload,
				testCase.result as ScorelinePayload,
				testCase.max_raw_points,
			);

			expect(
				evaluated.tierCode,
				`Tier mismatch for test: ${testCase.description}`,
			).toBe(testCase.expected_tier);

			expect(
				evaluated.rawPoints,
				`Raw points mismatch for test: ${testCase.description}`,
			).toBe(testCase.expected_raw_points);

			expect(
				evaluated.normalizedBasisPoints,
				`Normalized points mismatch for test: ${testCase.description}`,
			).toBe(testCase.expected_normalized_basis_points);
		}
	});
});
