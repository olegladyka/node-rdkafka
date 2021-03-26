/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

var Kafka = require('../');
var t = require('assert');
var crypto = require('crypto');

var eventListener = require('./listener');

var kafkaBrokerList = process.env.KAFKA_HOST || 'localhost:9092';

var serviceStopped = false;

describe('Producer', function() {

  var producer;

  describe('with dr_cb', function() {
    beforeEach(function(done) {
      producer = new Kafka.Producer({
        'client.id': 'kafka-test',
        'metadata.broker.list': kafkaBrokerList,
        'dr_cb': true,
        'debug': 'all'
      });
      producer.connect({}, function(err) {
        t.ifError(err);
        done();
      });

      eventListener(producer);
    });

    afterEach(function(done) {
      producer.disconnect(function() {
        done();
      });
    });

    it('should get 100% deliverability if transaction is commited', function(done) {
      this.timeout(3000);

      var total = 0;
      var max = 10000;
      var verified_received = 0;
      var init_transaction_timeout_ms = 200;

      var tt = setInterval(function() {
        producer.poll();
      }, 200);

      producer.connect();
      producer.initTransactions(init_transaction_timeout_ms);
      producer
        .on('delivery-report', function(err, report) {
          t.ifError(err);
          t.notStrictEqual(report, undefined);
          t.strictEqual(typeof report.topic, 'string');
          t.strictEqual(typeof report.partition, 'number');
          t.strictEqual(typeof report.offset, 'number');
          verified_received++;
          if (verified_received === max) {
            clearInterval(tt);
            done();
          }
          console.log(report);
        });

      // Produce
      for (total = 0; total <= max; total++) {
        producer.produce('test', null, Buffer.from('message ' + total), null);
      }

    });

  });

  describe('with_dr_msg_cb', function() {
    beforeEach(function(done) {
      producer = new Kafka.Producer({
        'client.id': 'kafka-test',
        'metadata.broker.list': kafkaBrokerList,
        'dr_msg_cb': true,
        'debug': 'all'
      });
      producer.connect({}, function(err) {
        t.ifError(err);
        done();
      });

      eventListener(producer);
    });

    afterEach(function(done) {
      producer.disconnect(function() {
        done();
      });
    });

    it('should produce a message with a payload and key', function(done) {
      this.timeout(3000);

      var tt = setInterval(function() {
        producer.poll();
      }, 200);

      producer.once('delivery-report', function(err, report) {
        clearInterval(tt);
        t.ifError(err);
        t.notStrictEqual(report, undefined);
        t.strictEqual(typeof report.topic, 'string');
        t.strictEqual(typeof report.partition, 'number');
        t.strictEqual(typeof report.offset, 'number');
        t.ok(report.key.toString(), 'key');
        t.equal(report.value.toString(), 'hai');
        done();
      });

      producer.produce('test', null, Buffer.from('hai'), 'key');
    });

    it('should produce a message with an empty payload and empty key (https://github.com/Blizzard/node-rdkafka/issues/117)', function(done) {
      this.timeout(3000);

      var tt = setInterval(function() {
        producer.poll();
      }, 200);

      producer.once('delivery-report', function(err, report) {
        clearInterval(tt);
        t.ifError(err);
        t.notStrictEqual(report, undefined);

        t.strictEqual(typeof report.topic, 'string');
        t.strictEqual(typeof report.partition, 'number');
        t.strictEqual(typeof report.offset, 'number');
        t.equal(report.key.toString(), '', 'key should be an empty string');
        t.strictEqual(report.value.toString(), '', 'payload should be an empty string');
        done();
      });

      producer.produce('test', null, Buffer.from(''), '');
    });

    it('should produce a message with a null payload and null key  (https://github.com/Blizzard/node-rdkafka/issues/117)', function(done) {
      this.timeout(3000);

      producer.setPollInterval(10);

      producer.once('delivery-report', function(err, report) {
        t.ifError(err);
        t.notStrictEqual(report, undefined);

        t.strictEqual(typeof report.topic, 'string');
        t.strictEqual(typeof report.partition, 'number');
        t.strictEqual(typeof report.offset, 'number');
        t.strictEqual(report.key, null, 'key should be null');
        t.strictEqual(report.value, null, 'payload should be null');
        done();
      });

      producer.produce('test', null, null, null);
    });

    it('should produce an int64 key (https://github.com/Blizzard/node-rdkafka/issues/208)', function(done) {

      var v1 = 0x0000000000000084;
      var arr = new Uint8Array(8);
      arr[0] = 0x00;
      arr[1] = 0x00;
      arr[2] = 0x00;
      arr[3] = 0x00;
      arr[4] = 0x00;
      arr[5] = 0x00;
      arr[6] = 0x00;
      arr[7] = 84;
      var buf = Buffer.from(arr.buffer);

      producer.setPollInterval(10);

      producer.once('delivery-report', function(err, report) {
        t.ifError(err);
        t.notStrictEqual(report, undefined);

        t.deepEqual(buf, report.key);
        done();
      });

      producer.produce('test', null, null, Buffer.from(arr.buffer));

      this.timeout(3000);
    });

  });

});
