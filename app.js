(function() {

	return {

		currAttempt : 0,

		MAX_ATTEMPTS : 20,

		defaultState: 'loading',

		profileData: {},

		storeUrl: '',

		resources: {
			PROFILE_URI				: '/admin/customers/search.json?query=email:',
			CUSTOMER_URI			: '%@/admin/customers/%@',
			ORDER_URI					: '%@/admin/orders/%@'
		},

		requests: {
			'getProfile' : function(email) {
				return this.getRequest(this.storeUrl + this.resources.PROFILE_URI + email);
			},
			'getOrder' : function(order_id) {
				return this.getRequest(helpers.fmt(this.resources.ORDER_URI, this.storeUrl, order_id + ".json"));
			}
		},

		events: {
			'app.activated'             : 'init',
			'requiredProperties.ready'  : 'queryShopify',
			'getProfile.done'						: 'handleGetProfile',
			'getOrder.done'							: 'handleGetOrder',
			'click .toggle-address'     : 'toggleAddress',

			'shopifyData.ready': function() {
				this.switchTo('profile', this.profileData);
			}
		},

		requiredProperties : [
			'ticket.requester.email'
		],

		init: function(data){
			if(!data.firstLoad){
				return;
			}

			this.storeUrl = this.checkStoreUrl(this.settings.url);

			this.allRequiredPropertiesExist();
		},

		queryShopify: function(){
			this.switchTo('requesting');
			this.ajax('getProfile', this.ticket().requester().email());
		},

		allRequiredPropertiesExist: function() {
			if (this.requiredProperties.length > 0) {
				var valid = this.validateRequiredProperty(this.requiredProperties[0]);

				// prop is valid, remove from array
				if (valid) {
					this.requiredProperties.shift();
				}

				if (this.requiredProperties.length > 0 && this.currAttempt < this.MAX_ATTEMPTS) {
					if (!valid) {
						++this.currAttempt;
					}

					_.delay(_.bind(this.allRequiredPropertiesExist, this), 100);
					return;
				}
			}

			if (this.currAttempt < this.MAX_ATTEMPTS) {
				this.trigger('requiredProperties.ready');
			} else {
				this.showError(this.I18n.t('global.error.title'), this.I18n.t('global.error.data'));
			}
		},

		validateRequiredProperty: function(property) {
			var parts = property.split('.');
			var part = '', obj = this;

			while (parts.length) {
				part = parts.shift();
				try {
					obj = obj[part]();
				} catch (e) {
					return false;
				}
				// check if property is invalid
				if (parts.length > 0 && !_.isObject(obj)) {
					return false;
				}
				// check if value returned from property is invalid
				if (parts.length === 0 && (_.isNull(obj) || _.isUndefined(obj) || obj === '' || obj === 'no')) {
					return false;
				}
			}

			return true;
		},

		getRequest: function(resource) {
			return {
				headers  : {
					'Authorization': 'Basic ' + Base64.encode(this.settings.api_key + ':' + this.settings.password)
				},
				url      : resource,
				method   : 'GET',
				dataType : 'json'
			};
		},

		checkStoreUrl: function(url) {
			// First, lets make sure there is no trailing slash, we'll add one later.
			if (url.slice(-1) === '/') { url = url.slice(0, -1); }
			// Test whether we have a front-controller reference here.
			if (url.indexOf('index.php') === -1)
			{
				// Nothing to do, the front-controller isn't in the url, pass it back unaltered.
				return url;
			}
			url = url.replace(/\/index.php/g, '');
			return url;
		},

		handleGetProfile: function(data) {
			if (data.errors) {
				this.showError(null, data.errors);
				return;
			}

			if (data.customers.length === 0) {
				this.showError(this.I18n.t('global.error.customerNotFound'), " ");
				return;
			}

			this.profileData = data.customers[0];

			if (this.profileData.note === "" || this.profileData.note === null) { 
				this.profileData.note = this.I18n.t('global.error.notes');
			}

			this.profileData.customer_uri = helpers.fmt(this.resources.CUSTOMER_URI,this.storeUrl,this.profileData.id);

			if (this.settings.order_id_field_id) {
				var orderId;
				customFieldName = 'custom_field_' + this.settings.order_id_field_id;
				orderId = this.ticket().customField(customFieldName);

				if (orderId) {
					this.ajax('getOrder', orderId);
				} else {
					this.trigger('shopifyData.ready');
				}
			} else {
				this.trigger('shopifyData.ready');
			}
		},

		handleGetOrder: function(data) {
			this.profileData.ticketOrder = data.order;
			this.profileData.ticketOrder.uri = helpers.fmt(this.resources.ORDER_URI, this.storeUrl, data.order.id);

			this.trigger('shopifyData.ready');
		},

		toggleAddress: function (e) {
			this.$(e.target).parent().next('p').toggleClass('hide');
			return false;
		},

		showError: function(title, msg) {
			this.switchTo('error', {
				title: title || this.I18n.t('global.error.title'),
				message: msg || this.I18n.t('global.error.message')
			});
		},

		handleFail: function() {
			// Show fail message
			this.showError();
		}
	};

}());