using System;
using System.IO;
using System.Runtime.CompilerServices;
using System.Threading.Tasks;
using Siemens.Engineering;
using TiaOpennessWrapper.Models;
using TiaOpennessWrapper.Services;
using TiaOpennessWrapper.Services.Export;

namespace TiaOpennessWrapper;

public class TiaPortalService
{
	private readonly TiaConnectionManager _connectionManager;

	private readonly ProjectStructureBuilder _structureBuilder;

	private BlockImportService? _blockImportService;

	private TagTableImportService? _tagTableImportService;

	private UdtImportService? _udtImportService;

	private WatchTableImportService? _watchTableImportService;

	private HmiImportService? _hmiImportService;

	private LibraryImportService? _libraryImportService;

	private XmlExportToTiaService? _xmlExportToTiaService;

	private HwConfigImportService? _hwConfigImportService;

	private HwConfigExportToTiaService? _hwConfigExportToTiaService;

	private CompileService? _compileService;

	private BlockGroupService? _blockGroupService;

	private OrphanCleanupService? _orphanCleanupService;

	private CrossReferenceExportService? _crossReferenceExportService;

	private ProjectBase? Project => _connectionManager.CurrentProject;

	public TiaPortalService()
	{
		_structureBuilder = new ProjectStructureBuilder();
		_connectionManager = new TiaConnectionManager(_structureBuilder);
		_connectionManager.OnProjectSelected = InitializeServices;
	}

	private T Ensure<T>(T? service, [CallerMemberName] string? caller = null) where T : class
	{
		return service ?? throw new InvalidOperationException(typeof(T).Name + " not initialized. Select a project first. (caller: " + caller + ")");
	}

	private void InitializeServices()
	{
		_blockImportService = new BlockImportService(_connectionManager);
		_tagTableImportService = new TagTableImportService(_connectionManager);
		_udtImportService = new UdtImportService(_connectionManager);
		_watchTableImportService = new WatchTableImportService(_connectionManager);
		_hmiImportService = new HmiImportService(_connectionManager);
		_libraryImportService = new LibraryImportService();
		_xmlExportToTiaService = new XmlExportToTiaService(_connectionManager);
		_hwConfigImportService = new HwConfigImportService();
		_hwConfigExportToTiaService = new HwConfigExportToTiaService();
		_compileService = new CompileService(_connectionManager);
		_blockGroupService = new BlockGroupService(_connectionManager);
		_orphanCleanupService = new OrphanCleanupService(_connectionManager);
		_crossReferenceExportService = new CrossReferenceExportService(_connectionManager);
	}

	private void ClearServices()
	{
		_blockImportService = null;
		_tagTableImportService = null;
		_udtImportService = null;
		_watchTableImportService = null;
		_hmiImportService = null;
		_libraryImportService = null;
		_xmlExportToTiaService = null;
		_hwConfigImportService = null;
		_hwConfigExportToTiaService = null;
		_compileService = null;
		_blockGroupService = null;
		_orphanCleanupService = null;
		_crossReferenceExportService = null;
	}

	public Task<object> ConnectAsync()
	{
		return _connectionManager.ConnectAsync();
	}

	public async Task DisconnectAsync()
	{
		await _connectionManager.DisconnectAsync();
		ClearServices();
	}

	public async Task DetachAsync()
	{
		await _connectionManager.DetachAsync();
		ClearServices();
	}

	public Task<object> PingAsync()
	{
		return _connectionManager.PingAsync();
	}

	public Task<object> GetProjectsAsync()
	{
		return _connectionManager.GetProjectsAsync();
	}

	public Task<object> OpenProjectAsync(string projectPath)
	{
		return _connectionManager.OpenProjectAsync(projectPath);
	}

	public Task<object> SelectProjectAsync(string projectName)
	{
		return _connectionManager.SelectProjectAsync(projectName);
	}

	public Task<object> GetProjectStructureAsync(string projectName)
	{
		return _connectionManager.GetProjectStructureAsync(projectName);
	}

	public Task<object> ExportBlocksAsync(string projectName, string deviceId, string plcId, string exportPath, TiaExportOptions options)
	{
		return Ensure(_blockImportService, "ExportBlocksAsync").ExportBlocksAsync(Project, deviceId, exportPath, options);
	}

	public Task<object> ExportBlockGroupAsync(string projectName, string deviceId, string plcId, string groupId, string exportPath, TiaExportOptions options)
	{
		return Ensure(_blockImportService, "ExportBlockGroupAsync").ExportBlockGroupAsync(Project, deviceId, groupId, exportPath, options);
	}

	public Task<object> ExportBlockGroupWithPathAsync(string projectName, string deviceId, string plcId, string groupId, string groupName, string groupPath, string exportPath, TiaExportOptions options)
	{
		return Ensure(_blockImportService, "ExportBlockGroupWithPathAsync").ExportBlockGroupWithPathAsync(Project, deviceId, groupName, groupPath, exportPath, options);
	}

	public Task<object> ExportBlockAsync(string projectName, string deviceId, string blockId, string exportPath, TiaExportOptions options)
	{
		return Ensure(_blockImportService, "ExportBlockAsync").ExportBlockAsync(Project, deviceId, blockId, exportPath, options);
	}

	public Task<object> ExportBlockWithPathAsync(string projectName, string deviceId, string blockId, string groupPath, string exportPath, TiaExportOptions options)
	{
		return Ensure(_blockImportService, "ExportBlockWithPathAsync").ExportBlockWithPathAsync(Project, deviceId, blockId, groupPath, exportPath, options);
	}

	public Task<object> ExportHmiScreensAsync(string projectName, string deviceId, string exportPath, TiaExportOptions options)
	{
		return Ensure(_hmiImportService, "ExportHmiScreensAsync").ExportHmiScreensAsync(Project, deviceId, exportPath, options);
	}

	public Task<object> ExportHmiTagsAsync(string projectName, string deviceId, string exportPath, TiaExportOptions options)
	{
		return Ensure(_hmiImportService, "ExportHmiTagsAsync").ExportHmiTagsAsync(Project, deviceId, exportPath, options);
	}

	public Task<object> ExportHmiConnectionsAsync(string projectName, string deviceId, string exportPath, TiaExportOptions options)
	{
		return Ensure(_hmiImportService, "ExportHmiConnectionsAsync").ExportHmiConnectionsAsync(Project, deviceId, exportPath, options);
	}

	public Task<object> ExportAllHmiAsync(string projectName, string deviceId, string exportPath, TiaExportOptions options)
	{
		return Ensure(_hmiImportService, "ExportAllHmiAsync").ExportAllHmiAsync(Project, deviceId, exportPath, options);
	}

	public Task<object> ExportTagTablesAsync(string projectName, string deviceId, string plcId, string exportPath, TiaExportOptions options)
	{
		return Ensure(_tagTableImportService, "ExportTagTablesAsync").ExportTagTablesAsync(Project, deviceId, exportPath, options.GenerateXlsx);
	}

	public Task<object> ExportTagTablesFromGroupAsync(string projectName, string deviceId, string plcId, string groupName, string groupPath, string exportPath, bool generateXlsx = false)
	{
		return Ensure(_tagTableImportService, "ExportTagTablesFromGroupAsync").ExportTagTablesFromGroupAsync(Project, deviceId, groupName, groupPath, exportPath, generateXlsx);
	}

	public Task<object> ExportSingleTagTableAsync(string projectName, string deviceId, string plcId, string tagTableId, string exportPath, bool generateXlsx = false)
	{
		return Ensure(_tagTableImportService, "ExportSingleTagTableAsync").ExportSingleTagTableAsync(Project, deviceId, tagTableId, exportPath, generateXlsx);
	}

	public Task<object> ExportUserDataTypesAsync(string projectName, string deviceId, string plcId, string exportPath, TiaExportOptions options)
	{
		return Ensure(_udtImportService, "ExportUserDataTypesAsync").ExportUserDataTypesAsync(Project, deviceId, exportPath);
	}

	public Task<object> ExportUdtsFromGroupAsync(string projectName, string deviceId, string plcId, string groupName, string groupPath, string exportPath)
	{
		return Ensure(_udtImportService, "ExportUdtsFromGroupAsync").ExportUdtsFromGroupAsync(Project, deviceId, groupName, groupPath, exportPath);
	}

	public Task<object> ExportSingleUdtAsync(string projectName, string deviceId, string plcId, string udtId, string exportPath)
	{
		return Ensure(_udtImportService, "ExportSingleUdtAsync").ExportSingleUdtAsync(Project, deviceId, udtId, exportPath);
	}

	public Task<object> ExportLibraryTypesAsync(string projectName, string exportPath, TiaExportOptions options)
	{
		return Ensure(_libraryImportService, "ExportLibraryTypesAsync").ExportLibraryTypesAsync(Project, exportPath, options);
	}

	public Task<object> ExportLibraryFolderAsync(string projectName, string folderPath, string exportPath, TiaExportOptions options)
	{
		return Ensure(_libraryImportService, "ExportLibraryFolderAsync").ExportLibraryFolderAsync(Project, folderPath, exportPath, options);
	}

	public Task<object> ExportLibraryTypeAsync(string projectName, string folderPath, string typeName, string exportPath, TiaExportOptions options)
	{
		return Ensure(_libraryImportService, "ExportLibraryTypeAsync").ExportLibraryTypeAsync(Project, folderPath, typeName, exportPath, options);
	}

	public Task<object> ExportWatchTablesAsync(string projectName, string deviceId, string plcId, string exportPath, TiaExportOptions options)
	{
		return Ensure(_watchTableImportService, "ExportWatchTablesAsync").ExportWatchTablesAsync(Project, deviceId, exportPath);
	}

	public Task<object> ExportWatchTablesFromGroupAsync(string projectName, string deviceId, string plcId, string groupName, string groupPath, string exportPath)
	{
		return Ensure(_watchTableImportService, "ExportWatchTablesFromGroupAsync").ExportWatchTablesFromGroupAsync(Project, deviceId, groupName, groupPath, exportPath);
	}

	public Task<object> ExportSingleWatchTableAsync(string projectName, string deviceId, string plcId, string watchTableId, string exportPath)
	{
		return Ensure(_watchTableImportService, "ExportSingleWatchTableAsync").ExportSingleWatchTableAsync(Project, deviceId, watchTableId, exportPath);
	}

	public Task<object> CreateInstanceDBAsync(string deviceId, string instanceDbName, string instanceOfName, int blockNumber = 0, string? groupPath = null)
	{
		return Ensure(_blockGroupService, "CreateInstanceDBAsync").CreateInstanceDBAsync(Project, deviceId, instanceDbName, instanceOfName, blockNumber, groupPath);
	}

	public Task<object> CreateBlockGroupsAsync(string deviceId, string[] groupPaths, string? basePath = null)
	{
		return Ensure(_blockGroupService, "CreateBlockGroupsAsync").CreateBlockGroupsAsync(deviceId, groupPaths, basePath);
	}

	public void CleanExportCaches(string? basePath)
	{
		InstanceDbSourceGenerator.CleanIdbSourceCache(basePath);
		XmlComparisonService.CleanComparisonDebugCache(basePath);
	}

	public Task<object> ImportXmlFileToTiaAsync(string projectName, string deviceId, string xmlFilePath, bool overwriteExisting = true, string? basePath = null, bool compareBeforeImport = false, string? sourceXlsxPath = null)
	{
		return Ensure(_xmlExportToTiaService, "ImportXmlFileToTiaAsync").ExportXmlFileAsync(Project, deviceId, xmlFilePath, new ExportToTiaOptions
		{
			OverwriteExisting = overwriteExisting,
			Recursive = false,
			BasePath = basePath,
			PreserveFolderStructure = !string.IsNullOrEmpty(basePath),
			CompareBeforeImport = compareBeforeImport,
			SourceXlsxPath = sourceXlsxPath
		});
	}

	public Task<object> ImportXmlFolderToTiaAsync(string projectName, string deviceId, string folderPath, bool overwriteExisting = true, bool recursive = true)
	{
		string directoryName = Path.GetDirectoryName(folderPath);
		return Ensure(_xmlExportToTiaService, "ImportXmlFolderToTiaAsync").ExportXmlFolderAsync(Project, deviceId, folderPath, new ExportToTiaOptions
		{
			OverwriteExisting = overwriteExisting,
			Recursive = recursive,
			BasePath = (directoryName ?? folderPath),
			PreserveFolderStructure = true
		});
	}

	public Task<object> DeleteOrphanedBlockGroupsAsync(string deviceId, string localFolderPath, string? basePath = null)
	{
		return Ensure(_orphanCleanupService, "DeleteOrphanedBlockGroupsAsync").DeleteOrphanedBlockGroupsAsync(deviceId, localFolderPath, basePath);
	}

	public Task<object> DeleteOrphanedTagTablesAsync(string deviceId, string localFolderPath)
	{
		return Ensure(_orphanCleanupService, "DeleteOrphanedTagTablesAsync").DeleteOrphanedTagTablesAsync(deviceId, localFolderPath);
	}

	public Task<object> DeleteOrphanedTypesAsync(string deviceId, string localFolderPath)
	{
		return Ensure(_orphanCleanupService, "DeleteOrphanedTypesAsync").DeleteOrphanedTypesAsync(deviceId, localFolderPath);
	}

	public Task<object> DeleteOrphanedWatchTablesAsync(string deviceId, string localFolderPath)
	{
		return Ensure(_orphanCleanupService, "DeleteOrphanedWatchTablesAsync").DeleteOrphanedWatchTablesAsync(deviceId, localFolderPath);
	}

	public Task<object> ImportHwConfigAsync(bool includeChannels = true, bool includeAddresses = true, bool includeNetworkConfig = true, bool includeSubnets = true, bool exportToXml = false, string? exportPath = null, string? format = null)
	{
		return Ensure(_hwConfigImportService, "ImportHwConfigAsync").ImportHwConfigAsync(Project, new HwConfigImportOptions
		{
			IncludeChannels = includeChannels,
			IncludeAddresses = includeAddresses,
			IncludeNetworkConfig = includeNetworkConfig,
			IncludeSubnets = includeSubnets,
			ExportToXml = exportToXml,
			ExportPath = exportPath,
			Format = HwConfigFormat.Normalize(format)
		});
	}

	public Task<object> ImportDeviceHwConfigAsync(string deviceName, bool includeChannels = true, bool includeAddresses = true, bool includeNetworkConfig = true, bool exportToXml = false, string? exportPath = null, string? format = null)
	{
		return Ensure(_hwConfigImportService, "ImportDeviceHwConfigAsync").ImportDeviceHwConfigAsync(Project, deviceName, new HwConfigImportOptions
		{
			IncludeChannels = includeChannels,
			IncludeAddresses = includeAddresses,
			IncludeNetworkConfig = includeNetworkConfig,
			IncludeSubnets = false,
			ExportToXml = exportToXml,
			ExportPath = exportPath,
			Format = HwConfigFormat.Normalize(format)
		});
	}

	public Task<object> ExportHwConfigFileToTiaAsync(string xmlFilePath, bool overwriteExisting = false, bool updateExisting = true, bool importNetworkConfig = true, bool skipIfIdentical = true, bool showComparisonDetails = true, string? format = null)
	{
		return Ensure(_hwConfigExportToTiaService, "ExportHwConfigFileToTiaAsync").ExportHwConfigFileAsync(Project, xmlFilePath, new HwConfigExportToTiaOptions
		{
			OverwriteExisting = overwriteExisting,
			UpdateExisting = updateExisting,
			ImportNetworkConfig = importNetworkConfig,
			SkipIfIdentical = skipIfIdentical,
			ShowComparisonDetails = showComparisonDetails,
			Format = HwConfigFormat.Normalize(format)
		});
	}

	public Task<object> ExportHwConfigFolderToTiaAsync(string folderPath, bool overwriteExisting = false, bool updateExisting = true, bool importNetworkConfig = true, bool skipIfIdentical = true, bool showComparisonDetails = true, string? format = null)
	{
		return Ensure(_hwConfigExportToTiaService, "ExportHwConfigFolderToTiaAsync").ExportHwConfigFolderAsync(Project, folderPath, new HwConfigExportToTiaOptions
		{
			OverwriteExisting = overwriteExisting,
			UpdateExisting = updateExisting,
			ImportNetworkConfig = importNetworkConfig,
			SkipIfIdentical = skipIfIdentical,
			ShowComparisonDetails = showComparisonDetails,
			Format = HwConfigFormat.Normalize(format)
		});
	}

	public Task<object> CompileSoftwareAsync(string deviceId)
	{
		return Ensure(_compileService, "CompileSoftwareAsync").CompileSoftwareAsync(Project, deviceId);
	}

	public Task<object> ExportCrossReferencesAsync(string deviceId, string outputDirectory, bool includeUnused = true, bool includeMarkdown = true)
	{
		return Ensure(_crossReferenceExportService, "ExportCrossReferencesAsync").DumpAsync(Project, deviceId, outputDirectory, includeUnused, includeMarkdown);
	}
}

