module.exports = {
    apps: [
        {
            name: 'bridge-reverse-signer',
            script: 'run-reverse-signer.cjs',
            cwd: __dirname,
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '500M',
            env: {
                NODE_ENV: 'production'
            },
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            error_file: './logs/reverse-signer-error.log',
            out_file: './logs/reverse-signer-out.log',
            merge_logs: true,
            restart_delay: 5000,
            max_restarts: 10
        },
        {
            name: 'bridge-signer',
            script: 'run-signer.cjs',
            cwd: __dirname,
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '500M',
            env: {
                NODE_ENV: 'production'
            },
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            error_file: './logs/signer-error.log',
            out_file: './logs/signer-out.log',
            merge_logs: true,
            restart_delay: 5000,
            max_restarts: 10
        }
    ]
};
