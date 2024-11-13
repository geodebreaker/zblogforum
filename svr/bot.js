require('dotenv').config();
const un = process.env.BOT_UN;
const pw = process.env.BOT_PW;
const prompt =
	`respond to conversation in only text VERY SHORTLY and be a silly goober, 
	but still always correct, you are [AI], dont put markdown, 
	use :emojis: "mood", "goober", "silly", "horror", and "nohorror" all over,
	feel free to use line breaks
	THESE MESSAGES GO NEWEST FIRST:`;
const aiapi = process.env.BOT_AI;
var atk = null;

process.on('uncaughtException', e => console.error(e))

async function api(x, y) {
	var x = await fetch('https://evrtdg.com/api/' + x, {
		method: 'post',
		body: JSON.stringify(y) ?? '{}',
		headers: atk ? {
			cookie: 'AUTH_TOKEN=' + atk
		} : undefined
	}).catch(
		z => console.error(z)
	);
	if (!x) return;
	if (!x.ok) {
		console.error(await x.text());
		return {};
	};
	var z = x.headers.get('set-cookie').match(/(?<=AUTH_TOKEN=).*?(?=;)/);
	if (z) atk = z[0];
	x = await x.text();
	try {
		x = JSON.parse(x);
	} catch (e) {
		console.error(e)
	}
	if (x.type == 'signin') await api('signin', { un, pw });
	if (x.fail) console.error(x.fail);
	return x;
}

async function setup() {
	await api('signin', { un, pw });
	setInterval(loop, 20e3);
	loop();
}

async function loop() {
	var y = await api('content', { q: '/' });
	var x = y.posts.filter(x => x.interact > y.since).map(async x => {
		var b = await api('content', { q: '/@' + x.user + '/' + x.id });
		var d = b.post.replies.at(-1);
		if (!d ? b.post.data.startsWith('!ai ') : d.data.startsWith('!ai ')) {
			var f = [b.post].concat(b.post.replies).map(x => [x.user, x.data])
				.filter(x => x[1].startsWith('!ai ') || x[0] == un)
				.map(x => ({ from: x[0] == un ? '[AI]' : x[0], data: x[1] })).reverse();
			try {
				console.log('\x07ai did ' + f.at(-1).from + ': ' + f.at(-1).data);
				e = await fetch(aiapi + encodeURI(prompt + JSON.stringify(f))).then(e => e.json());
				api('reply', { p: x.user + '/' + x.id, d: '[AI] ' + e });
			} catch (e) {
				console.error(e)
			}
		} else {
			var z;
			if (d && (Math.random() < 0.1 || d.data.startsWith('!pic ')))
				z = d.data;
			if (b.post.replies.length == 0 && (Math.random() < 0.4 || b.post.data.startsWith('!pic ')))
				z = b.post.data;
			if (!z) return console.log('failed');
			z = z.replace('!pic ', '');
			var c = parseInt(z);
			z = z.replace(parseInt(z), '');
			var a = await fetch('https://www.google.com/search?q=' + encodeURI(z) + '&udm=2', {
				headers: {
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like '
						+ 'Gecko) Chrome/87.0.4280.88 Safari/537.36'
				}
			}).then(e => e.text());
			a = (a.match(/(?<=")https:\/\/[^"]*?\.(jpg|png|gif|jpeg)(?=")/g) ?? []);
			if (!a) return;
			a.shift();
			if (c) a = a[c]; else a = a[0];
			console.log('\x07did ' + z + (c ? ' #' + c : ''));
			api('reply', { p: x.user + '/' + x.id, d: '{p,' + a.replaceAll(',', '\\,') + ',300,300}' });
		}
	});
	if (x) api('clearnew');
}

setup();
