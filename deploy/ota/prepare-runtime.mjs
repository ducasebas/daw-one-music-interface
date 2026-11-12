/** Build dependencies without privilege, then expose runtime code read-only to
 * the application user. The updater's private umask must not hide node_modules.
 * GNU chmod -R does not follow symlinks encountered inside the candidate tree.
 */
export function prepareRuntime(destination, run) {
  run('chown', ['-R', 'dawupdatebuild:dawupdatebuild', destination]);
  run('runuser', [
    '-u', 'dawupdatebuild', '--', 'env', '-i', 'PATH=/usr/bin:/bin',
    'HOME=/var/lib/daw-one-update-build', 'npm', 'ci', '--prefix', destination,
    '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund',
  ]);
  run('chown', ['-R', 'root:root', destination]);
  run('chmod', ['-R', 'a+rX,go-w', destination]);
}
