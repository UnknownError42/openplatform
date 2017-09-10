NEWSCHEMA('Meta').make(function(schema) {
	schema.define('url', 'Url', true);

	schema.addWorkflow('exec', function($) {
		RESTBuilder.make(function(builder) {
			builder.url($.model.url);
			builder.exec(function(err, response) {
				err && $.error.push(err);
				$.callback(SUCCESS(true, response));
			});
		});
	});
});

NEWSCHEMA('App').make(function(schema) {

	schema.define('url', 'Url', true);
	schema.define('title', 'String(30)', true);
	schema.define('settings', String);
	schema.define('accesstoken', 'String(50)');

	schema.define('allownotifications', Boolean);
	schema.define('allowreadusers', Number);        // 0: disabled, 1: basic info (name, photo, online), 2: all info (contact), 3: basic info only users which have this app, 4: all info only users which have this app
	schema.define('allowreadapps', Number);         // 0: disabled, 1: basic info, 2: all info
	schema.define('allowreadprofile', Number);      // 0: disabled, 1: basic info, 2: all info
	schema.define('allowreadmeta', Boolean);
	schema.define('responsive', Boolean);
	schema.define('blocked', Boolean);

	schema.setSave(function($) {

		if (!$.controller.user.sa) {
			$.error.push('error-permissions');
			return $.callback();
		}

		var model = $.model.$clean();
		var item = F.global.apps.findItem('url', model.url);

		model.search = (model.name + ' ' + model.title).toSearch();
		model.linker = model.title.slug();

		if (item == null) {
			item = model;
			item.id = U.GUID(20);
			item.datecreated = F.datetime;
			F.global.apps.push(item);
		} else {
			model.dateupdated = F.datetime;
			sync(item, model, true);
		}

		OP.save(); // Save changes
		EMIT('apps.refresh', item);
		$.callback(SUCCESS(true));
	});

	schema.setRemove(function($) {

		if (!$.controller.user.sa) {
			$.error.push('error-permissions');
			return $.callback();
		}

		var id = $.controller.id;

		F.global.apps = F.global.apps.remove('id', id);
		F.global.users.forEach(function(item) {
			delete item.apps[id];
		});

		OP.save(); // Save changes
		EMIT('apps.refresh', id, true);
		$.callback(SUCCESS(true));
	});

	schema.addWorkflow('refresh', function($) {
		RESTBuilder.make(function(builder) {
			builder.url($.model.url);
			builder.exec(function(err, response) {

				if (response === EMPTYOBJECT || err) {
					$.error.push(err ? err : 'error-invalid-url');
					$.callback();
					return;
				}

				$.model.version = response.version;
				$.model.name = response.name;
				$.model.description = response.description;
				$.model.author = response.author;
				$.model.icon = response.icon;
				$.model.frame = response.url;
				$.model.email = response.email;
				$.model.roles = response.roles;
				$.model.custom = response.custom;
				$.model.online = true;
				$.model.daterefreshed = F.datetime;

				$.callback(SUCCESS(true));
			});
		});
	});

	schema.addWorkflow('state', function($) {
		F.global.apps.wait(function(item, next) {
			var builder = new RESTBuilder(item.url);
			builder.exec(function(err, response, output) {

				if (err || !response.url) {
					item.online = false;
				} else {
					item.hostname = output.hostname;
					item.online = true;
					item.version = response.version;
					item.name = response.name;
					item.description = response.description;
					item.author = response.author;
					item.icon = response.icon;
					item.frame = response.url;
					item.email = response.email;
					item.roles = response.roles;

					if (response.origin) {
						item.origin = {};
						for (var i = 0; i < response.origin.length; i++)
							item.origin[response.origin[i]] = true;
					} else
						item.origin = null;
				}

				item.daterefreshed = F.datetime;
				next();
			});

		}, function() {
			EMIT('apps.refresh');
			OP.saveState(1);
			$.callback(SUCCESS(true));
		});
	});
});

function sync(item, model, meta) {

	if (meta) {
		item.title = model.title;
		item.options = model.options;
		item.secret = model.secret;
		item.allowreadapps = model.allowreadapps;
		item.allowreadusers = model.allowreadusers;
		item.allownotifications = model.allownotifications;
		item.responsive = model.responsive;
		item.blocked = model.blocked;
		item.settings = model.settings;
		item.accesstoken = model.accesstoken;
	}

	item.linker = model.linker;
	item.version = model.version;
	item.name = model.name;
	item.description = model.description;
	item.author = model.author;
	item.icon = model.icon;
	item.frame = model.frame;
	item.email = model.email;
	item.roles = model.roles;
	item.version = model.version;
	item.custom = model.custom;
	item.online = model.online === true;
	item.daterefreshed = F.datetime;
}

ON('service', function(counter) {
	counter % 2 === 0 && $WORKFLOW('App', 'state', NOOP);
});