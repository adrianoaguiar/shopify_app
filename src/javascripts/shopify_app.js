import BaseApp from 'base_app';

var gravatar = require('gravatar');

var ShopifyApp = {
  orderLimit: 3,

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
    PROFILE_URI       : '/admin/customers/search.json',
    CUSTOMER_URI      : '/admin/customers/',
    ORDERS_URI        : '/admin/orders.json',
    ORDER_PATH        : '/admin/orders/'
  },

  requests: {
    'getProfile' : function(email) {
      var request = this.getRequest(this.resources.PROFILE_URI);

      request.data = {query: 'email:' + email};

      return request;
    },
    'getOrders' : function(customer_id) {
      var self = this;
      var additional_fields = 'name,id,currency';
      var fields = _.reject(this.orderFieldsMap, function(value, key) {
        return !self.setting(key);
      });

      if (_.size(fields) > 0) {
        additional_fields += ',' + fields.join();
      }

      var request = this.getRequest(this.resources.ORDERS_URI);

      request.data = {
        customer_id: customer_id,
        fields: additional_fields,
        status: 'any',
        limit: this.orderLimit
      };

      return request;
    },
    'getOrder': function(order_id) {
      return this.getRequest(this.resources.ORDER_PATH + order_id + '.json');
    }
  },

  events: {
    'app.created': 'init',
    'ticket.requester.email.changed' : 'queryCustomer',
    'getProfile.done' : 'handleProfile',
    'getProfile.fail' : 'handleProfileFail',
    'getOrders.done' : 'handleOrders',
    'getOrders.fail' : 'handleOrdersFail',
    'getOrder.done' : 'handleOrder',
    'getOrder.fail' : 'handleOrdersFail',
    'shown.bs.collapse #accordion': 'resizeApp',
    'hidden.bs.collapse #accordion': 'resizeApp'
  },

  init: function() {
    this.storeUrl = this.storeUrl || this.checkStoreUrl(this.setting('url'));

    if (this.currentLocation() === 'ticket_sidebar') {
      this.queryCustomer();
    }
  },

  getRequest: function(resource) {
    return {
      headers  : {
        'X-Shopify-Access-Token': this.setting('access_token')
      },
      url      : this.storeUrl + resource,
      method   : 'GET',
      dataType : 'json'
    };
  },

  handleProfile: function(data) {
    if (data.errors) {
      this.showError(null, data.errors);
      return;
    }

    if (data.customers.length === 0) {
      this.showError(this.I18n.t('global.error.customerNotFound'), " ");
      return;
    }

    this.customer = data.customers[0];

    if (this.setting('customer_notes') && (this.customer.note === "" || this.customer.note === null)) {
      this.customer.note = this.I18n.t('customer.no_notes');
    } else {
      this.customer.note = null;
    }

    this.customer.uri = this.storeUrl + this.resources.CUSTOMER_URI + this.customer.id;
    this.customer.image = gravatar.url(this.customer.email, {s: 20, d: 'mm'});

    this.switchTo('customer', {
      customer: this.customer
    });

    this.displayOrder();
  },

  handleProfileFail: function(response) {
    if (response.status == 401) {
      this.switchTo('setup');
    } else {
      var error = JSON.parse(response.responseText);
      this.showError(error.errors);
    }
  },

  displayOrder: function() {
    var _self = this;

    this.zafClient.get('requirement:shopify_order_id').then(function(data) {
      if (_.isUndefined(data['requirement:shopify_order_id'])) {
        _self.ajax('getOrders', _self.customer.id);
      }

      var fieldId = data['requirement:shopify_order_id'].requirement_id;
      var fieldName = 'ticket.customField:custom_field_' + fieldId;

      _self.zafClient.get(fieldName).then(function(customField) {
        if (!_.isEmpty(customField[fieldName])) {
          _self.ajax('getOrder', customField[fieldName]);
        } else {
          _self.ajax('getOrders', _self.customer.id);
        }
      });
    });
  },

  handleOrder: function(data) {
    this.$('section[data-orders]').html(
      this.renderTemplate('order/single', this.fmtOrder(data.order))
    );

    this.$('#order-' + data.order.id).addClass('in');

    this.resizeApp();
  },

  handleOrders: function(data) {
    // Format order data
    this.orders = _.map(data.orders, function(order) {
      return this.fmtOrder(order);
    }.bind(this));

    this.$('section[data-orders]').html(
      this.renderTemplate('order/list', {
        orders: this.orders.slice(0,3),
        ordersUri: this.storeUrl + this.resources.ORDER_PATH
      })
    );

    this.resizeApp();
  },

  handleOrdersFail: function(response) {
    var error = JSON.parse(response.responseText);
    this.showError(this.I18n.t('global.error.orders'), error.errors);
    return;
  },

  fmtOrder: function(order) {
    var newOrder = order;

    newOrder.uri = this.storeUrl + this.resources.ORDER_PATH + order.id;

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

    if (!_.isUndefined(order.fulfillment_status)) {
      if (order.fulfillment_status != null) {
        newOrder.order_status = order.fulfillment_status;
      }
      newOrder.fulfillment_status = true;
    }

    if (order.note === "" || order.note === null) {
      newOrder.note = this.I18n.t('customer.no_notes');
    }

    if (order.created_at) {
      newOrder.created_at = this.localeDate(order.created_at);
    }

    return newOrder;
  }
}

export default BaseApp.extend(ShopifyApp);
