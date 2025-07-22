import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Html,
	Link,
	Preview,
	Section,
	Text,
} from "@react-email/components";

interface WelcomeEmailProps {
	username: string;
	loginUrl?: string;
}

export function WelcomeEmail({
	username = "John Doe",
	loginUrl = "https://goosebumps.fm/auth/signin",
}: WelcomeEmailProps) {
	return (
		<Html>
			<Head />
			<Preview>Welcome to goosebumps.fm, {username}! 🎵</Preview>
			<Body style={main}>
				<Container style={container}>
					<Section style={header}>
						<Heading style={h1}>goosebumps.fm</Heading>
						<Text style={subtitle}>Your music journey starts here</Text>
					</Section>

					<Section style={content}>
						<Heading style={h2}>Welcome, {username}! 🎉</Heading>
						<Text style={text}>
							Thank you for joining the goosebumps.fm community! We're excited
							to have you on board and can't wait to see what you'll create.
						</Text>

						<Text style={text}>With your new account, you can:</Text>

						{/* <ul style={featureList}>
							<li style={featureItem}>Share your music and mixes</li>
							<li style={featureItem}>Connect with other artists</li>
							<li style={featureItem}>Discover new sounds</li>
							<li style={featureItem}>Build your music profile</li>
						</ul> */}

						<Button style={button} href={loginUrl}>
							Get Started
						</Button>

						<Text style={text}>
							If you have any questions or need help getting started, feel free
							to reach out to our support team.
						</Text>
					</Section>

					<Section style={footer}>
						<Text style={footerText}>
							Best regards,
							{/* <br /> */}
							The goosebumps.fm Team
						</Text>
						<Text style={footerText}>
							<Link href="https://goosebumps.fm" style={link}>
								goosebumps.fm
							</Link>
						</Text>
					</Section>
				</Container>
			</Body>
		</Html>
	);
}

const main = {
	backgroundColor: "#f6f9fc",
	fontFamily:
		"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

const container = {
	backgroundColor: "#ffffff",
	margin: "0 auto",
	padding: "20px 0 48px",
	marginBottom: "64px",
};

const header = {
	textAlign: "center" as const,
	padding: "48px 0",
	backgroundColor: "#1a1a1a",
	color: "#ffffff",
};

const h1 = {
	color: "#ffffff",
	fontSize: "32px",
	fontWeight: "bold",
	margin: "0 0 8px",
	textAlign: "center" as const,
};

const subtitle = {
	color: "#cccccc",
	fontSize: "16px",
	margin: "0",
	textAlign: "center" as const,
};

const content = {
	padding: "48px 24px",
};

const h2 = {
	color: "#1a1a1a",
	fontSize: "24px",
	fontWeight: "bold",
	margin: "0 0 16px",
};

const text = {
	color: "#333333",
	fontSize: "16px",
	lineHeight: "24px",
	margin: "0 0 16px",
};

const button = {
	backgroundColor: "#1a1a1a",
	borderRadius: "6px",
	color: "#ffffff",
	fontSize: "16px",
	fontWeight: "bold",
	textDecoration: "none",
	textAlign: "center" as const,
	display: "block",
	width: "200px",
	padding: "12px",
	margin: "32px auto",
};

const footer = {
	borderTop: "1px solid #e6e6e6",
	padding: "32px 24px",
	textAlign: "center" as const,
};

const footerText = {
	color: "#666666",
	fontSize: "14px",
	lineHeight: "20px",
	margin: "0 0 8px",
};

const link = {
	color: "#1a1a1a",
	textDecoration: "underline",
};

export default WelcomeEmail;
