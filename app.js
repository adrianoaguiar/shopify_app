(function() {

	return {

		errorCodes: _.range(400,416),

		currAttempt : 0,

		MAX_ATTEMPTS : 20,

		defaultState: 'loading',

		profileData: {},

		storeUrl: '',

		resources: {
			PROFILE_URI				: '/api/v2/customers.json?email=',
			RECENT_ORDERS_URI	: '/api/v2/orders.json?customer_id=',
			CUSTOMER_URI			: '%@/admin/index.php?ToDo=searchCustomersRedirect&idFrom=%@&idTo=%@',
			ORDER_URI					: '%@/admin/index.php?ToDo=searchOrdersRedirect&orderFrom=%@&orderTo=%@'
		},

		requests: {
			'getProfile' : function(email) {
				return this.getRequest(this.storeUrl + this.resources.PROFILE_URI + email);
			},
			'getOrders' : function(customer_id) {
				return this.getRequest(this.storeUrl + this.resources.RECENT_ORDERS_URI + customer_id);
			}
		},

		events: {
			'app.activated'             : 'init',
			'requiredProperties.ready'  : 'queryBigCommerce',
			'getProfile.fail'						: 'handleGetProfileError',
			'getProfile.done'						: 'handleGetProfile',
			'getOrders.done'						: 'handleGetOrders',

			'getOrders.always'					: function() {
				this.switchTo('profile',this.profileData);
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

		queryBigCommerce: function(){
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
					'Authorization': 'Basic ' + Base64.encode(this.settings.username + ':' + this.settings.api_token)
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
			if (_.isUndefined(data[0])) return;

			// checks if status returned a HTTP error instead of order status (proxy bug)
			if (_.indexOf(this.errorCodes, data[0].status) !== -1 && !_.isUndefined(data[0].message)) {
				this.showError(this.I18n.t('global.error.title'),data[0].message);
				return;
			}

			this.profileData = data[0];

			if (data[0].notes === "") { 
				this.profileData.notes = "No notes yet.";
			} else {
				this.profileData.notes = data[0].notes;
			}

			this.profileData.customer_uri = helpers.fmt(this.resources.CUSTOMER_URI,this.storeUrl,this.profileData.id,this.profileData.id);
			this.profileData.ordersCount = 0;
			this.ajax('getOrders', this.profileData.id);
		},

		handleGetOrders: function(data) {
			if (_.isUndefined(data[0])) return;
			this.profileData.recentOrders = data;
			this.profileData.ordersCount = data.length;

			if (data.length > 3) {
				this.profileData.recentOrders = data.slice(data.length-3, data.length).reverse();
			} else {
				this.profileData.recentOrders = data.reverse();
			}

			_.each(this.profileData.recentOrders, function(order) {
				order.uri = helpers.fmt(this.resources.ORDER_URI,this.storeUrl,order.id,order.id);
			}, this);

			this.checkTicketOrder(data);
		},

		checkTicketOrder : function(data) {
			var customFieldName, orderId;

			if (this.settings.order_id_field_id) {
				customFieldName = 'custom_field_' + this.settings.order_id_field_id;
				orderId = this.ticket().customField(customFieldName);

				if (orderId) {
					this.profileData.ticketOrder = _.find(data, function(order){
						return (order.id == orderId);
					});

					if (!_.isUndefined(this.profileData.ticketOrder)) {
						// formatting of numbers and dates
						var date_length = this.profileData.ticketOrder.date_created.length;
						this.profileData.ticketOrder.subtotal_inc_tax = parseFloat(this.profileData.ticketOrder.subtotal_inc_tax).toFixed(2);
						this.profileData.ticketOrder.total_inc_tax = parseFloat(this.profileData.ticketOrder.total_inc_tax).toFixed(2);
						this.profileData.ticketOrder.date_created = this.profileData.ticketOrder.date_created.substr(0,date_length - 6);
						this.profileData.ticketOrder.date_shipped = this.profileData.ticketOrder.date_shipped.substr(0,date_length - 6);
					}
				}
			}
		},

		showError: function(title, msg) {
			this.switchTo('error', {
				title: title || this.I18n.t('global.error.title'),
				message: msg || this.I18n.t('global.error.message')
			});
		},

		handleGetProfileError: function() {
			// Show fail message
			this.showError(this.I18n.t('global.error.customerNotFound'), " ");
		},

		handleFail: function() {
			// Show fail message
			this.showError();
		}
	};

}());