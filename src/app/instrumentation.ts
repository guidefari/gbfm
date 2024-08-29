import * as Sentry from "@sentry/nextjs";

export function register() {
	Sentry.init({
		dsn: "https://6698428c07e44ccbb83372b6057b407d@o452087.ingest.us.sentry.io/5439010",

		// Adjust this value in production, or use tracesSampler for greater control
		tracesSampleRate: 1,

		// Setting this option to true will print useful information to the console while you're setting up Sentry.
		debug: false,

		// uncomment the line below to enable Spotlight (https://spotlightjs.com)
		// spotlight: process.env.NODE_ENV === 'development',
	});
}
