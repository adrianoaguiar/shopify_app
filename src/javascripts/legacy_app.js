import BaseApp from 'base_app';

var sprintf = require('sprintf-js').sprintf;
var App = {

  orderFieldsMap: {
    "items_purchased": "line_items",
    "item_quantity": "quantity",
    "item_price": "price",
    "purchase_total": "total_price",
    "order_status": "fulfillment_status",
    "date_ordered": "created_at",
    "shipping_address": "shipping_address",
    "shipping_method": "shipping_lines",
    "billing_address": "billing_address",
    "order_notes": "note"
  },

  defaultState: 'loading',

  storeUrl: '',

  resources: {
    PROFILE_URI       : '/admin/customers/search.json?query=email:',
    CUSTOMER_URI      : '%1$s/admin/customers/%2$d',
    ORDERS_URI        : '%1$s/admin/orders.json?customer_id=%2$d&status=any&fields=name,id,created_at,currency%3$s',
    ORDER_PATH        : '%1$s/admin/orders/%2$d'
  },

  requests: {
    'getProfile' : function(email) {
      return this.getRequest(this.storeUrl + this.resources.PROFILE_URI + email);
    },
    'getOrders' : function(customer_id) {
      var self = this;
      var additional_fields = '';
      var fields = _.reject(this.orderFieldsMap, function(key) {
        return self.setting(key);
      });

      if (_.size(fields) > 0) {
        additional_fields = ',' + fields.join();
      }

      return this.getRequest(sprintf(this.resources.ORDERS_URI, this.storeUrl, customer_id, additional_fields));
    }
  },

  events: {
    'app.created': 'init',
    'ticket.requester.email.changed' : 'queryCustomer',
    'getProfile.done' : 'handleProfile',
    'getOrders.done' : 'handleOrders',
    'shown.bs.collapse #accordion': 'resizeApp',
    'hidden.bs.collapse #accordion': 'resizeApp'
  },

  init: function() {
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

    if (this.setting('customer_notes') && (this.customer.note === "" || this.customer.note === null)) {
      this.customer.note = this.I18n.t('customer.no_notes');
    } else {
      this.customer.note = null;
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

    // Format order data
    this.orders = _.map(data.orders, function(order) {
      return this.fmtOrder(order);
    }.bind(this));

    this.switchTo('customer', {
      customer: this.customer,
      recentOrders: this.orders.slice(0,3),
      ordersUri: sprintf('%s/admin/orders', this.storeUrl)
    });
  },

  findOrder: function(orderId) {
    return _.find(this.orders, function(order){
      return ((order.order_number == orderId) || (order.name == orderId) || (order.name == '#' + orderId));
    });
  },

  fmtOrder: function(order) {
    var newOrder = order;

    newOrder.uri = sprintf(this.resources.ORDER_PATH, this.storeUrl, order.id);

    if (true || this.setting('items_purchased')) {    
      newOrder.items_purchased = _.map(order.line_items, function(line_item) {
        var item = [];
        item.title = line_item.title;

        if (true || this.setting('item_price')) { item.price = line_item.price; }
        if (true || this.setting('item_quantity')) { item.quantity = line_item.quantity; }

        return item;
      }.bind(this));
    }

    newOrder.order_status = "not_fulfilled";

    if (order.fulfillment_status) {
      newOrder.order_status = order.fulfillment_status
    }

    if (order.note === "" || order.note === null) {
      newOrder.note = this.I18n.t('customer.no_notes');
    }

    newOrder.created_at = this.localeDate(order.created_at);

    return newOrder;
  },

  localeDate: function(date) {
    return new Date(date).toLocaleString(this.currentLocale);
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
  },

  resizeApp: function() {
    let newHeight = Math.min($('body').height(), 600);
    this.zafClient.invoke('resize', { height: newHeight, width: '100%' });
  }
}

export default BaseApp.extend(App);
