/** 100000〜999999を偏りのない暗号論的乱数で生成する。 */
export function generateVerificationCode(random = () => crypto.getRandomValues(new Uint32Array(1))[0]): string {
  const range = 900000
  const limit = Math.floor(2 ** 32 / range) * range
  let value: number
  do { value = random() } while (value >= limit)
  return String(100000 + value % range)
}
