'use strict';
/* globals $, app, socket */

define('admin/plugins/chats-global', ['settings'], function(Settings) {

	var ACP = {};

	ACP.init = function() {
		Settings.load('chats-global', $('.chats-global-settings'));

		$('#save').on('click', function() {
			Settings.save('chats-global', $('.chats-global-settings'), function() {
				app.alert({
					type: 'success',
					alert_id: 'chats-global-saved',
					title: 'Settings Saved',
					message: 'Please reload your NodeBB to apply these settings',
					clickfn: function() {
						socket.emit('admin.reload');
					}
				});
			});
		});
	};

	return ACP;
});
