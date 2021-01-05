const alipayToBaidu = require('../cli/alipay-baidu/index')

module.exports = function(program, cb = () => {}) {
  program
    .command('alipay-baidu')
    .action((...params) => {
      cb(params, alipayToBaidu)
    })
}
