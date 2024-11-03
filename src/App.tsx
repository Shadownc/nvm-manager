import { useState, useEffect } from 'react';
import './App.css';
declare global {
  interface Window {
    electronAPI: {
      getInstalledVersions: () => Promise<{ success: boolean; versions: { version: string; status: string; }[]; message: string }>;
      getAvailableNodeVersions: () => Promise<{ success: boolean; versions: { version: string; npmVersion: string; status: string; }[]; message: string }>;
      installNodeVersion: (version: string) => Promise<{ success: boolean; message: string }>;
      switchNodeVersion: (version: string) => Promise<{ success: boolean; message: string }>;
      uninstallNodeVersion: (version: string) => Promise<{ success: boolean; message: string }>;
    };
  }
}


const App = () => {
  const [activeTab, setActiveTab] = useState('versions');
  const [availableVersions, setAvailableVersions] = useState<{ version: string; npmVersion: string; status: string; }[]>([]);
  const [installedVersions, setInstalledVersions] = useState<{ version: string; isCurrent: boolean; }[]>([]);
  const [result, setResult] = useState<string>('');
  const [loadingVersion, setLoadingVersion] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const compareVersions = (a: { version: string }, b: { version: string }) => {
    const parseVersion = (version: string) => version.split('.').map((num) => parseInt(num, 10));
    const [aMajor, aMinor, aPatch] = parseVersion(a.version);
    const [bMajor, bMinor, bPatch] = parseVersion(b.version);

    if (aMajor !== bMajor) return bMajor - aMajor;
    if (aMinor !== bMinor) return bMinor - aMinor;
    return bPatch - aPatch;
  };


  const fetchInstalledVersions = async () => {
    try {
      const response = await window.electronAPI.getInstalledVersions();
      if (response.success) {
        const versionsWithIsCurrent = response.versions.map((version) => ({
          ...version,
          isCurrent: false, // 初始设为 false，可以根据当前版本更新此字段
        }));
        setInstalledVersions(versionsWithIsCurrent.sort(compareVersions));
      } else {
        showResult(response.message, 'error');
      }
    } catch (error) {
      showResult('Error fetching installed versions', 'error');
      console.error('Error fetching installed versions:', error);
    }
  };


  const fetchAvailableVersions = async () => {
    try {
      const response = await window.electronAPI.getAvailableNodeVersions();
      if (response.success) {
        const sortedVersions = response.versions.sort(compareVersions);
        setAvailableVersions(sortedVersions);
      } else {
        showResult(response.message, 'error');
      }
    } catch (error) {
      showResult('Error fetching available versions', 'error');
      console.error('Error fetching available versions:', error);
    }
  };

  useEffect(() => {
    const fetchVersions = async () => {
      setIsLoading(true); // 开始加载
      try {
        await Promise.all([fetchAvailableVersions(), fetchInstalledVersions()]);
      } catch (error) {
        console.error('Error fetching versions:', error);
      } finally {
        setIsLoading(false); // 结束加载
      }
    };
    fetchVersions();
  }, []);

  const showResult = (message: string, type: 'success' | 'error' = 'success') => {
    setResult(message);
    setTimeout(() => setResult(''), 5000);
  };

  const handleInstallVersion = async (version: string) => {
    setLoadingVersion(version);
    setLoadingAction('install');
    try {
      const response = await window.electronAPI.installNodeVersion(version);
      showResult(response.message, response.success ? 'success' : 'error');
      if (response.success) {
        await Promise.all([fetchInstalledVersions(), fetchAvailableVersions()]);
      }
    } catch (error) {
      showResult('Error installing version', 'error');
      console.error('Error installing version:', error);
    } finally {
      setLoadingVersion(null);
      setLoadingAction('');
    }
  };

  const handleSwitchVersion = async (version: string) => {
    setLoadingVersion(version);
    setLoadingAction('switch');
    try {
      const response = await window.electronAPI.switchNodeVersion(version);
      showResult(response.message, response.success ? 'success' : 'error');
      if (response.success) {
        await fetchInstalledVersions();
      }
    } catch (error) {
      showResult('Error switching version', 'error');
      console.error('Error switching version:', error);
    } finally {
      setLoadingVersion(null);
      setLoadingAction('');
    }
  };

  const handleUninstallVersion = async (version: string) => {
    setLoadingVersion(version);
    setLoadingAction('uninstall');
    try {
      const response = await window.electronAPI.uninstallNodeVersion(version);
      showResult(response.message, response.success ? 'success' : 'error');
      if (response.success) {
        await Promise.all([fetchInstalledVersions(), fetchAvailableVersions()]);
      }
    } catch (error) {
      showResult('Error uninstalling version', 'error');
      console.error('Error uninstalling version:', error);
    } finally {
      setLoadingVersion(null);
      setLoadingAction('');
    }
  };

  const shouldDisplayNpmColumn = availableVersions.some(
    (versionInfo) => versionInfo.npmVersion && versionInfo.npmVersion !== 'unknown'
  );

  return (
    <div className="App">
      <h1 className="gradient-text">Node.js Version Manager</h1>

      <div className="tabs">
        <button
          className={`tab-button ${activeTab === 'versions' ? 'active' : ''}`}
          onClick={() => setActiveTab('versions')}
          disabled={loadingVersion !== null}
        >
          Available Versions
        </button>
        <button
          className={`tab-button ${activeTab === 'installed' ? 'active' : ''}`}
          onClick={() => setActiveTab('installed')}
          disabled={loadingVersion !== null}
        >
          Installed Versions
        </button>
      </div>

      <div className="version-container">
        {isLoading ? (
          <div className="loading-container">
            <div className="list-loader"></div>
            <div className="loading-text">Loading versions...</div>
          </div>
        ) : (
          activeTab === 'versions' ? (
            <div className="version-list">
              <h2>Available Versions</h2>
              <div className="grid-header">
                <div>Version</div>
                {shouldDisplayNpmColumn && <div>NPM Version</div>}
                <div>Status</div>
                <div>Action</div>
              </div>

              {availableVersions.map((versionInfo, index) => (
                <div key={index} className="version-item">
                  <div>{versionInfo.version}</div>

                  {shouldDisplayNpmColumn && (
                    <div>
                      {versionInfo.npmVersion !== 'unknown' ? versionInfo.npmVersion : '--'}
                    </div>
                  )}

                  <div>
                    <span className={`status-badge ${versionInfo.status === "Installed" ? 'installed' : 'not-installed'}`}>
                      {versionInfo.status === "Installed" ? 'Installed' : 'Not Installed'}
                    </span>
                  </div>

                  <div>
                    {versionInfo.status === "Installed" ? (
                      <button
                        className="action-button use"
                        onClick={() => handleSwitchVersion(versionInfo.version)}
                        disabled={loadingVersion !== null}
                      >
                        {loadingVersion === versionInfo.version && loadingAction === 'switch' ? (
                          <span className="loader"></span>
                        ) : (
                          'Use'
                        )}
                      </button>
                    ) : (
                      <button
                        className="action-button install"
                        onClick={() => handleInstallVersion(versionInfo.version)}
                        disabled={loadingVersion !== null}
                      >
                        {loadingVersion === versionInfo.version && loadingAction === 'install' ? (
                          <span className="loader"></span>
                        ) : (
                          'Install'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="version-list">
              <h2>Installed Versions</h2>
              <div className="grid-header">
                <div>Version</div>
                <div>Actions</div>
              </div>

              {installedVersions.map((versionData, index) => (
                <div key={index} className="version-item">
                  <div>
                    {versionData.version}
                    {versionData.isCurrent && <span className="current-badge">Current</span>}
                  </div>

                  <div className="action-buttons">
                    {versionData.isCurrent ? (
                      <button className="action-button current" disabled>
                        Current
                      </button>
                    ) : (
                      <>
                        <button
                          className="action-button switch"
                          onClick={() => handleSwitchVersion(versionData.version)}
                          disabled={loadingVersion !== null}
                        >
                          {loadingVersion === versionData.version && loadingAction === 'switch' ? (
                            <span className="loader"></span>
                          ) : (
                            'Switch'
                          )}
                        </button>
                        <button
                          className="action-button uninstall"
                          onClick={() => handleUninstallVersion(versionData.version)}
                          disabled={loadingVersion !== null}
                        >
                          {loadingVersion === versionData.version && loadingAction === 'uninstall' ? (
                            <span className="loader"></span>
                          ) : (
                            'Uninstall'
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {result && <div className="result-message">{result}</div>}
    </div>
  );
};

export default App;
