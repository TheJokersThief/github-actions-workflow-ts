import {
	Workflow,
	NormalJob,
	Step,
	expressions as ex,
	multilineString,
	echoKeyValue,
} from '../src'

const checkout = new Step({
	name: 'Checkout',
	uses: 'actions/checkout@v3',
	with: {
		ref: ex.expn('github.event.release.target_commitish'),
	},
})

const installNode = new Step({
	name: 'Install Node',
	uses: 'actions/setup-node@v3',
	with: { 'node-version': 18 },
})

const installPnpm = new Step({
	name: 'Install pnpm',
	uses: 'pnpm/action-setup@v2',
	with: { version: 8 },
})

const installDependencies = new Step({
	name: 'Install Dependencies',
	run: 'pnpm install --no-frozen-lockfile',
})

const bumpVersion = new Step({
	name: 'Bump Version',
	run: multilineString(
		`git config user.name github-actions`,
		`git config user.email github-actions@github.com`,
		`echo version: ${ex.expn('github.event.release.tag_name')}`,
		`npm version ${ex.expn('github.event.release.tag_name')}`,
	),
})

const runBuild = new Step({
	name: 'Run Build',
	run: 'pnpm build',
})

const npmPublish = new Step({
	name: 'Publish to npm',
	run: multilineString(
		echoKeyValue.to(
			'//registry.npmjs.org/:_authToken',
			ex.secret('NPM_TOKEN'),
			'.npmrc',
		),
		'npm publish',
	),
	env: {
		NPM_AUTH_TOKEN: ex.secret('NPM_TOKEN'),
	},
})

const gitPush = new Step({
	name: 'Push updates to GitHub',
	shell: 'bash',
	run: multilineString(
		`git add .`,
		`git commit --no-verify -m "Release ${ex.expn(
			'github.event.release.tag_name',
		)}"`,
		`git push origin HEAD:${ex.expn('github.event.release.target_commitish')}`,
		`git tag --force ${ex.expn('github.event.release.tag_name')}`,
		`git push --force origin ${ex.expn(
			'github.event.release.target_commitish',
		)}`,
	),
})

const publishJob = new NormalJob('Publish', {
	'runs-on': 'ubuntu-latest',
	'timeout-minutes': 20,
	permissions: {
		contents: 'write',
	},
}).addSteps([
	checkout,
	installNode,
	installPnpm,
	installDependencies,
	runBuild,
	bumpVersion,
	npmPublish,
	gitPush,
])

export const publishWorkflow = new Workflow('publish', {
	name: 'Publish Release',
	on: {
		release: {
			types: ['published'],
		},
	},
}).addJob(publishJob)
