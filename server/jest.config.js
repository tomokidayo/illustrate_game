/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  // ゲームタイマーなどの非同期ハンドルが残るためプロセスを強制終了する
  forceExit: true,
};
