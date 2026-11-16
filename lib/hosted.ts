// True in the static GitHub Pages build (`npm run build:example`). That build has no server,
// so pages compute from the bundled synthetic data and AI panels use their scripted samples.
export const HOSTED_EXAMPLE = process.env.NEXT_PUBLIC_HOSTED_EXAMPLE === 'true';
