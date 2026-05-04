/** 메인 루프 주기. 시그널 확인·스케줄링이 이 간격으로 반복된다. */
export const LOOP_INTERVAL_MS = 3000;
/** healthCheck 를 몇 루프마다 돌릴지 (실제 시간 ≈ 루프 간격 × 배수). */
export const HEALTHCHECK_EVERY_N_LOOPS = 10;
/** 할 일·워커가 모두 없을 때 대기 로그를 몇 루프마다 찍을지. */
export const IDLE_LOG_EVERY_N_LOOPS = 5;
