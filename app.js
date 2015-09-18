(function() {

  return {

    MAX_ATTEMPTS : 20,

    defaultState: 'loading',
    locale: undefined,

    storeUrl: '',

    resources: {
      PROFILE_URI       : '/admin/customers/search.json?query=email:',
      CUSTOMER_URI      : '%@/admin/customers/%@',
      ORDERS_URI        : '%@/admin/orders.json?customer_id=%@&status=any',
      ORDER_PATH        : '%@/admin/orders/%@'
    },

    requests: {
      'getZendeskUser': {
        url: '/api/v2/users/me.json',
        proxy_v2: true
      },

      'getProfile' : function(email) {
        return this.getRequest(this.storeUrl + this.resources.PROFILE_URI + email);
      },
      'getOrders' : function(customer_id) {
        return this.getRequest(helpers.fmt(this.resources.ORDERS_URI, this.storeUrl, customer_id));
      }
    },

    events: {
      'app.activated'                  : 'init',
      'ticket.requester.email.changed' : 'queryCustomer',
      '*.changed'                      : 'handleChanged',
      'requiredProperties.ready'       : 'queryCustomer',
      'getProfile.done'                : 'handleProfile',
      'getOrders.done'                 : 'handleOrders',
      'getOrder.done'                  : 'handleOrder',
      'getZendeskUser.done'            : 'handleZendeskUser',
      'click .toggle-address'          : 'toggleAddress'
    },

    init: function(data){
      if(!data.firstLoad){
        return;
      }
      this.ajax('getZendeskUser').done((function() {
        this.hasActivated = true;
        this.currAttempt = 0;
        this.storeUrl = this.storeUrl || this.checkStoreUrl(this.settings.url);
        this.requiredProperties = [
          'ticket.requester.email'
        ];

        if (this.currentLocation() === 'ticket_sidebar') {
          this.allRequiredPropertiesExist();
        } else if (this.ticket().requester()) {
          // user may have selected a requester and reloaded the app
          this.queryCustomer();
        }
      }).bind(this));
    },

    queryCustomer: function() {
      if (this.hasActivated) {
        this.switchTo('requesting');
        this.ajax('getProfile', this.ticket().requester().email());
      }
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

    handleZendeskUser: function(data) {
      this.locale = data.user.locale;
    },

    handleChanged: _.debounce(function(e) {
      // test if change event fired before app.activated
      if (!this.hasActivated) {
        return;
      }

      if (e.propertyName === helpers.fmt("ticket.custom_field_%@", this.settings.order_id_field_id)) {
        this.showTicketOrder(e.newValue);
      }
    }, 500),

    handleProfile: function(data) {
      if (data.errors) {
        this.showError(null, data.errors);
        return;
      }

      if (data.customers.length === 0) {
        if (!_.isEmpty(this.orderId)) {
          this.queryOrder();
        } else {
          this.showError(this.I18n.t('global.error.customerNotFound'), " ");
        }
        return;
      }

      this.customer = data.customers[0];

      if (this.customer.note === "" || this.customer.note === null) {
        this.customer.note = this.I18n.t('customer.no_notes');
      }

      this.customer.uri = helpers.fmt(this.resources.CUSTOMER_URI,this.storeUrl,this.customer.id);

      // Get customers's 50 most recent orders
      this.ajax('getOrders', this.customer.id);
    },

    handleOrders: function(data) {
      if (data.errors) {
        this.showError(this.I18n.t('global.error.orders'), data.errors);
        return;
      }

      // Format order data
      this.orders = _.map(data.orders, function(order) {
        return this.fmtOrder(order);
      }, this);

      this.updateTemplate('customer', {
        customer: this.customer,
        recentOrders: this.orders.slice(0,3)
      });

      if (this.settings.order_id_field_id) {
        var orderId = this.ticket().customField('custom_field_' + this.settings.order_id_field_id);
        this.showTicketOrder(orderId);
      }
    },

    showTicketOrder: function(orderId) {
      if (orderId) {
        // Check if custom field order is in the array
        var ticketOrder = _.find(this.orders, function(order){
          return (order.name == "#" + orderId);
        });

        if (ticketOrder) {
          this.updateTemplate('order', ticketOrder);
        } else {
          this.showError(this.I18n.t('global.error.orderNotFound'), " ", 'order');
        }
      }
    },

    fmtOrder: function(order) {
      var newOrder = order;

      newOrder.uri = helpers.fmt(this.resources.ORDER_PATH, this.storeUrl, order.id);

      if (!order.fulfillment_status) {
        newOrder.fulfillment_status = "not_fulfilled";
      }

      if (order.note === "" || order.note === null) {
        newOrder.note = this.I18n.t('customer.no_notes');
      }

      if (order.cancelled_at) {
        newOrder.cancelled_at = this.localeDate(order.cancelled_at);
      }

      if (order.closed_at) {
        newOrder.closed_at = this.localeDate(order.closed_at);
      }

      if (order.currency) {
        newOrder.currency_code = order.currency;
      }

      newOrder.created_at = this.localeDate(order.created_at);

      return newOrder;
    },

    localeDate: function(date) {
      return new Date(date).toLocaleString(this.locale);
    },

    toggleAddress: function (e) {
      this.$(e.target).parent().next('p').toggleClass('hide');
      return false;
    },

    updateTemplate: function(name, data, klass) {
      if (this.currentState !== 'profile') {
        this.switchTo('profile');
      }

      var selector = '.' + (klass || name);
      this.$(selector).html(this.renderTemplate(name, data));
    },

    showError: function(title, msg, klass) {
      var data = {
        title: title || this.I18n.t('global.error.title'),
        message: msg || this.I18n.t('global.error.message')
      };

      if (klass) {
        this.updateTemplate('error', data, klass);
      } else {
        this.switchTo('error', data);
      }
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

    handleFail: function() {
      // Show fail message
      this.showError();
    }

  };

}());
