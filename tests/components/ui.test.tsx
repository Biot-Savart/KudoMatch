import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('components/ui/button', () => {
	it('renders correctly and handles click events', async () => {
		const handleClick = vi.fn();
		render(<Button onClick={handleClick}>Click Me</Button>);

		const button = screen.getByRole('button', { name: /click me/i });
		expect(button).toBeInTheDocument();

		await userEvent.click(button);
		expect(handleClick).toHaveBeenCalledTimes(1);
	});

	it('can be rendered as child element (asChild)', () => {
		render(
			<Button asChild>
				<a href="/test">Link Button</a>
			</Button>,
		);
		const link = screen.getByRole('link', { name: /link button/i });
		expect(link).toBeInTheDocument();
		expect(link.tagName).toBe('A');
	});
});

describe('components/ui/avatar', () => {
	it('renders avatar root, image, and fallback correctly', () => {
		render(
			<Avatar>
				<AvatarImage
					src="/avatar.png"
					alt="User Alt"
				/>
				<AvatarFallback>U</AvatarFallback>
			</Avatar>,
		);
		expect(screen.getByText('U')).toBeInTheDocument();
	});
});

describe('components/ui/card', () => {
	it('renders all card subcomponents correctly', () => {
		render(
			<Card>
				<CardHeader>
					<CardTitle>Card Title</CardTitle>
					<CardDescription>Card Description</CardDescription>
				</CardHeader>
				<CardContent>
					<p>Card content text.</p>
				</CardContent>
				<CardFooter>
					<button>Action</button>
				</CardFooter>
			</Card>,
		);
		expect(screen.getByText('Card Title')).toBeInTheDocument();
		expect(screen.getByText('Card Description')).toBeInTheDocument();
		expect(screen.getByText('Card content text.')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /action/i })).toBeInTheDocument();
	});
});

describe('components/ui/input', () => {
	it('renders input and handles typing', async () => {
		render(<Input placeholder="Enter email" />);
		const input = screen.getByPlaceholderText('Enter email');
		expect(input).toBeInTheDocument();

		await userEvent.type(input, 'hello@world.com');
		expect(input).toHaveValue('hello@world.com');
	});
});

describe('components/ui/label', () => {
	it('renders label linked to input correctly', () => {
		render(
			<div>
				<Label htmlFor="email">Email Address</Label>
				<Input id="email" />
			</div>,
		);
		expect(screen.getByText('Email Address')).toBeInTheDocument();
		expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
	});
});

describe('components/ui/tabs', () => {
	it('renders tabs list, triggers, and contents correctly', async () => {
		render(
			<Tabs defaultValue="tab1">
				<TabsList>
					<TabsTrigger value="tab1">Tab One</TabsTrigger>
					<TabsTrigger value="tab2">Tab Two</TabsTrigger>
				</TabsList>
				<TabsContent value="tab1">Content One</TabsContent>
				<TabsContent value="tab2">Content Two</TabsContent>
			</Tabs>,
		);

		expect(screen.getByText('Content One')).toBeInTheDocument();
		expect(screen.queryByText('Content Two')).not.toBeInTheDocument();

		const triggerTwo = screen.getByRole('tab', { name: /tab two/i });
		await userEvent.click(triggerTwo);

		expect(screen.getByText('Content Two')).toBeInTheDocument();
		expect(screen.queryByText('Content One')).not.toBeInTheDocument();
	});
});
