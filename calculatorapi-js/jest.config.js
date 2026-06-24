module.exports = {
    testEnvironment: "node",
    coverageDirectory: "coverage",
    collectCoverageFrom: ["src/**/*.js"],
    testPathIgnorePatterns: ["/node_modules/", "/tests/e2e/"],
    coverageThreshold: {
        global: {
            branches: 90,
            functions: 90,
            lines: 88,
            statements: 89
        }
    }
}   
// a