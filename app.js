(function() {

  return {

    currAttempt : 0,

    MAX_ATTEMPTS : 20,

    defaultState: 'loading',

    profileData: {},

    storeUrl: '',

    resources: {
      PROFILE_URI       : '/admin/customers/search.json?query=email:',
      CUSTOMER_URI      : '%@/admin/customers/%@',
      ORDERS_URI        : '%@/admin/orders.json?customer_id=%@&status=any',
      ORDER_URI         : '%@/admin/orders/%@.json',
      ORDER_PATH         : '%@/admin/orders/%@'
    },

    requests: {
      'getProfile' : function(email) {
        return this.getRequest(this.storeUrl + this.resources.PROFILE_URI + email);
      },
      'getOrders' : function(customer_id) {
        return this.getRequest(helpers.fmt(this.resources.ORDERS_URI, this.storeUrl, customer_id));
      }
    },

    events: {
      'app.activated'             : 'init',
      'requiredProperties.ready'  : 'queryShopify',
      'getProfile.done'           : 'handleGetProfile',
      'getOrders.done'            : 'handleGetOrders',
      'getOrder.done'             : 'handleGetOrder',
      'click .toggle-address'     : 'toggleAddress',

      'shopifyData.ready': function() {
        this.switchTo('profile', this.profileData);
      }
    },

    init: function(data){
      if(!data.firstLoad){
        return;
      }

      this.requiredProperties = [
        'ticket.requester.email'
      ];

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
        this.showError(null, this.I18n.t('global.error.data'));
      }
    },

    safeGetPath: function(propertyPath) {
      return _.inject( propertyPath.split('.'), function(context, segment) {
        if (context == null) { return context; }
        var obj = context[segment];
        if ( _.isFunction(obj) ) { obj = obj.call(context); }
        return obj;
      }, this);
    },

    validateRequiredProperty: function(propertyPath) {
      var value = this.safeGetPath(propertyPath);
      return value != null && value !== '' && value !== 'no';
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
        this.profileData.note = this.I18n.t('customer.no_notes');
      }

      this.profileData.customer_uri = helpers.fmt(this.resources.CUSTOMER_URI,this.storeUrl,this.profileData.id);

      // Get customers's 50 most recent orders
      this.ajax('getOrders', this.profileData.id);
    },

    handleGetOrders: function(data) {
      if (data.errors) {
        this.showError(this.I18n.t('global.error.orders'), data.errors);
        return;
      }

      // Format order data
      var orders = _.map(data.orders, function(order) {
        return this.fmtOrder(order);
      }, this);

      // Get 3 most recent orders from requester
      this.profileData.recentOrders = orders.slice(0,3);

      if (this.settings.order_id_field_id) {
        var orderId,
            customFieldName;

        // Get custom field order ID
        customFieldName = 'custom_field_' + this.settings.order_id_field_id;
        orderId = this.ticket().customField(customFieldName);

        if (orderId) {
          // Check if custom field order is in the array
          this.profileData.ticketOrder = _.find(orders, function(order){
            return (order.order_number == orderId);
          });

          if (!this.profileData.ticketOrder) {
            this.showError(this.I18n.t('global.error.orderNotFound'), " ");
            return;
          }
        }
      }

      this.trigger('shopifyData.ready');
    },

    fmtOrder: function(order) {
      var newOrder = order;

      newOrder.uri = helpers.fmt(this.resources.ORDER_PATH, this.storeUrl, order.id);

      if (!order.fulfillment_status) {
        newOrder.fulfillment_status = "not-fulfilled";
      }

      if (order.note === "" || order.note === null) {
        newOrder.note = this.I18n.t('customer.no_notes');
      }

      if (order.cancelled_at) {
        newOrder.cancelled_at = new Date(order.cancelled_at).toLocaleString();
      }

      if (order.closed_at) {
        newOrder.closed_at = new Date(order.closed_at).toLocaleString();
      }

      newOrder.created_at = new Date(order.created_at).toLocaleString();

      return newOrder;
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