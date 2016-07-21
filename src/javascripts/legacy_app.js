import BaseApp from 'base_app';

var sprintf = require('sprintf-js').sprintf;
var App = {

  defaultState: 'loading',

  storeUrl: '',

  resources: {
    PROFILE_URI       : '/admin/customers/search.json?query=email:',
    CUSTOMER_URI      : '%1$s/admin/customers/%2$d',
    ORDERS_URI        : '%1$s/admin/orders.json?customer_id=%2$d&status=any',
    ORDER_PATH        : '%1$s/admin/orders/%2$d'
  },

  requests: {
    'getProfile' : function(email) {
      return this.getRequest(this.storeUrl + this.resources.PROFILE_URI + email);
    },
    'getOrders' : function(customer_id) {
      return this.getRequest(sprintf(this.resources.ORDERS_URI, this.storeUrl, customer_id));
    }
  },

  events: {
    'app.created': 'init',
    'ticket.requester.email.changed' : 'queryCustomer',
    'getProfile.done' : 'handleProfile',
    'getOrders.done' : 'handleOrders'
  },

  init: function(){
    this.storeUrl = this.storeUrl || this.checkStoreUrl(this.setting('url'));

    if (this.currentLocation() === 'ticket_sidebar') {
      this.queryCustomer();
    }
  },

  queryCustomer: function() {
    var self = this;
    this.switchTo('requesting');
    this.zafClient.get('ticket.requester.email').then(function(data) {
      self.ajax('getProfile', data["ticket.requester.email"]);
    });
  },

  getRequest: function(resource) {
    return {
      headers  : {
        'X-Shopify-Access-Token': this.setting('access_token')
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
    if (url.indexOf('index.php') === -1) {
      // Nothing to do, the front-controller isn't in the url, pass it back unaltered.
      return url;
    }
    url = url.replace(/\/index\.php/g, '');
    return url;
  },

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

    this.customer.uri = sprintf(this.resources.CUSTOMER_URI,this.storeUrl,this.customer.id);

    // Get customers's 50 most recent orders
    this.ajax('getOrders', this.customer.id);
  },

  handleOrders: function(data) {
    if (data.errors) {
      this.showError(this.I18n.t('global.error.orders'), data.errors);
      return;
    }
    var self = this;
    // Format order data
    this.orders = _.map(data.orders, function(order) {
      return self.fmtOrder(order);
    });

    this.switchTo('customer', {
      customer: this.customer,
      recentOrders: this.orders.slice(0,3)
    });
  },

  showTicketOrder: function(orderId) {
    if (orderId) {
      // Check if custom field order is in the array
      var ticketOrder = this.findOrder(orderId);

      if (ticketOrder) {
        this.updateTemplate('order', ticketOrder);
      } else {
        this.showError(this.I18n.t('global.error.orderNotFound'), " ", 'order');
      }
    }
  },

  findOrder: function(orderId) {
    return _.find(this.orders, function(order){
      return ((order.order_number == orderId) || (order.name == orderId) || (order.name == '#' + orderId));
    });
  },

  fmtOrder: function(order) {
    var newOrder = order;

    newOrder.uri = sprintf(this.resources.ORDER_PATH, this.storeUrl, order.id);

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
    return this.zafClient.get('currentUser.locale').then(function(data) {
        return new Date(date).toLocaleString(data['currentUser.locale']);
      }, this);
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

  handleFail: function() {
    // Show fail message
    this.showError();
  }
}

export default BaseApp.extend(App);
