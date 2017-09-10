const Fs = require('fs');

NEWSCHEMA('Settings').make(function(schema) {

	schema.define('url', 'String(500)', true);
	schema.define('email', 'Email', true);
	schema.define('smtp', 'String(100)');
	schema.define('smtpsettings', 'JSON');

	schema.setGet(function($) {
		var model = $.model;
		var options = F.config['mail-smtp-options'];
		model.url = F.config.url;
		model.email = F.config.email;
		model.smtp = F.config['mail-smtp'];
		model.smtpsettings = typeof(options) === 'string' ? options : JSON.stringify(options);
		$.callback();
	});

	schema.setSave(function($) {

		var model = $.model;

		if (model.url.endsWith('/'))
			model.url = model.url.substring(0, model.url.length - 1);

		F.config.url = model.url;
		F.config.author = model.author;
		F.config.email = model.email;
		F.config['mail-smtp'] = model.smtp;
		F.config['mail-smtp-options'] = model.smtpsettings.parseJSON();

		Fs.writeFile(F.path.databases('settings.json'), JSON.stringify(model.$clean()), NOOP);
		$.callback(SUCCESS(true));
	});

	schema.addWorkflow('init', function($) {
		Fs.readFile(F.path.databases('settings.json'), function(err, response) {

			if (response) {
				var model = response.toString('utf8').parseJSON(true);
				F.config.url = model.url;
				F.config.author = model.author;
				F.config.email = model.email;
				F.config['mail-smtp'] = model.smtp;
				F.config['mail-smtp-options'] = model.smtpsettings.parseJSON();
			}

			$.callback(SUCCESS(true));
		});
	});
});

NEWSCHEMA('SettingsSMTP').make(function(schema) {

	schema.define('smtp', 'String(100)', true);
	schema.define('smtpsettings', 'JSON');

	schema.addWorkflow('exec', function($) {

		var model = $.model;
		var options = model.smtpsettings.parseJSON();

		Mail.try(model.smtp, options, function(err) {

			if (err) {
				$.error.push('error-settings-smtp');
				$.error.replace('@', err.toString());
			}

			$.callback(SUCCESS(true));
		});
	});
});