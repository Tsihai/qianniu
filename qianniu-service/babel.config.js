export default {
  presets: [
    ['@babel/preset-env', {
      targets: {
        node: 'current'
      }
    }]
  ],
  plugins: [
    ['@babel/plugin-proposal-decorators', {
      legacy: true
    }],
    '@babel/plugin-proposal-class-properties'
  ],
  env: {
    test: {
      presets: [
        ['@babel/preset-env', {
          targets: {
            node: 'current'
          }
        }]
      ],
      plugins: [
        ['@babel/plugin-proposal-decorators', {
          legacy: true
        }],
        '@babel/plugin-proposal-class-properties'
      ]
    }
  }
};