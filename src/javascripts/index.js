import ShopifyApp from './shopify_app';
import ZAFClient from 'zendesk_app_framework_sdk';

var client = ZAFClient.init();

client.on('app.registered', function(data) {
	new ShopifyApp(client, data);
});
