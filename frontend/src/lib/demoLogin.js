/**
 * The demo account, pre-selected on the sign-in screen.
 *
 * Pre-filling a password field is a thing you do once and regret later, so the
 * rules here are deliberately strict:
 *
 *   - In a **development** build it is on by default, using the seeded dev
 *     account. That is the whole point: `npm start` should not make you type
 *     the same credentials fifty times a day.
 *
 *   - In a **production** build it is off unless someone opts in explicitly
 *     with `REACT_APP_DEMO_LOGIN=true`, **and** supplies the credentials
 *     themselves. There is no default pair in a production bundle, so the
 *     seeded dev password cannot be shipped by forgetting a flag — the worst
 *     an accidental flag can do is enable an empty form.
 *
 *   - Whenever it is on, the screen says so. A pre-filled form that does not
 *     explain itself invites someone to assume it is their own saved login.
 *
 * Config:
 *   REACT_APP_DEMO_LOGIN      'true' | 'false'  (default: on in development)
 *   REACT_APP_DEMO_EMAIL      overrides the account used
 *   REACT_APP_DEMO_PASSWORD
 *   REACT_APP_DEMO_LABEL      what to call it on screen
 */

const env = (name) => {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
};

const isDevelopment = process.env.NODE_ENV === 'development';
const flag = env('REACT_APP_DEMO_LOGIN');

/** Explicit `false` always wins, in either kind of build. */
const requested = flag === 'false' ? false : flag === 'true' ? true : isDevelopment;

/**
 * The seeded pair from `backend/seeds/01_dev_sample.js`. Referenced only in a
 * development build; a production bundle gets `undefined` here and must be
 * told what to use.
 */
const seeded = isDevelopment
  ? { email: 'dev@atlashelios.test', password: 'atlas-dev-password' }
  : { email: undefined, password: undefined };

const email = env('REACT_APP_DEMO_EMAIL') || seeded.email;
const password = env('REACT_APP_DEMO_PASSWORD') || seeded.password;

/** On only when it was asked for *and* there is actually an account to fill. */
export const demoLogin = {
  enabled: Boolean(requested && email && password),
  email: email || '',
  password: password || '',
  label: env('REACT_APP_DEMO_LABEL') || (isDevelopment ? 'Development seed account' : 'Demo account'),
  /**
   * True when someone turned this on in a production build without giving
   * credentials. Silently doing nothing would look like a broken flag, so the
   * sign-in screen reports it.
   */
  misconfigured: Boolean(requested && !isDevelopment && !(email && password))
};
