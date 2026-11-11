// Extra matchers for every component test (`toBeInTheDocument`, `toHaveClass`).
// Create React App loads this file automatically before each test file.
import '@testing-library/jest-dom';

/**
 * TextEncoder/TextDecoder in the test environment.
 *
 * react-router@7 reaches for them at import time. The jsdom bundled with
 * react-scripts@5 predates them being globals, so merely importing
 * `react-router-dom` in a test throws `ReferenceError: TextEncoder is not
 * defined` before a single assertion runs. Node has had both since v11, so
 * this is a one-line bridge rather than a dependency.
 */
import { TextDecoder, TextEncoder } from 'util';

if (typeof global.TextEncoder === 'undefined') global.TextEncoder = TextEncoder;
if (typeof global.TextDecoder === 'undefined') global.TextDecoder = TextDecoder;
