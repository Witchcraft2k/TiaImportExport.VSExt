using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using Microsoft.Win32;
using Siemens.Collaboration.Net;
using TiaOpennessWrapper.Interop;
using TiaOpennessWrapper.Interop.Handlers;

namespace TiaOpennessWrapper;

public class TiaConnector
{
	[StructLayout(LayoutKind.Auto)]
	[CompilerGenerated]
	private struct _003CInvoke_003Ed__10 : IAsyncStateMachine
	{
		private static class _003C_003Eo__10
		{
			public static CallSite<Func<CallSite, object, object>> _003C_003Ep__0;

			public static CallSite<Func<CallSite, object, object>> _003C_003Ep__1;

			public static CallSite<Func<CallSite, object, bool>> _003C_003Ep__2;

			public static CallSite<Func<CallSite, object, object>> _003C_003Ep__3;
		}

		public int _003C_003E1__state;

		public AsyncTaskMethodBuilder<object> _003C_003Et__builder;

		public object input;

		public TiaConnector _003C_003E4__this;

		private object _003C_003Eu__1;

		private void MoveNext()
		{
			int num = _003C_003E1__state;
			TiaConnector tiaConnector = _003C_003E4__this;
			object result;
			try
			{
				try
				{
					dynamic val2;
					if (num != 0)
					{
						string text = ((dynamic)input).method;
						dynamic val = ((dynamic)input).@params ?? new { };
						EnsureInitialized(TiaRequestBinder.GetVersionFromParams(val));
						val2 = tiaConnector._router.RouteAsync(text, val).GetAwaiter();
						if (!(bool)val2.IsCompleted)
						{
							num = (_003C_003E1__state = 0);
							_003C_003Eu__1 = val2;
							ICriticalNotifyCompletion awaiter = val2 as ICriticalNotifyCompletion;
							if (awaiter == null)
							{
								INotifyCompletion awaiter2 = (INotifyCompletion)(object)val2;
								_003C_003Et__builder.AwaitOnCompleted(ref awaiter2, ref this);
								awaiter2 = null;
							}
							else
							{
								_003C_003Et__builder.AwaitUnsafeOnCompleted(ref awaiter, ref this);
							}
							awaiter = null;
							return;
						}
					}
					else
					{
						val2 = _003C_003Eu__1;
						_003C_003Eu__1 = null;
						num = (_003C_003E1__state = -1);
					}
					result = val2.GetResult();
				}
				catch (Exception ex)
				{
					result = new
					{
						success = false,
						error = ex.Message
					};
				}
			}
			catch (Exception exception)
			{
				_003C_003E1__state = -2;
				_003C_003Et__builder.SetException(exception);
				return;
			}
			_003C_003E1__state = -2;
			_003C_003Et__builder.SetResult(result);
		}

		void IAsyncStateMachine.MoveNext()
		{
			//ILSpy generated this explicit interface implementation from .override directive in MoveNext
			this.MoveNext();
		}

		[DebuggerHidden]
		private void SetStateMachine(IAsyncStateMachine stateMachine)
		{
			_003C_003Et__builder.SetStateMachine(stateMachine);
		}

		void IAsyncStateMachine.SetStateMachine(IAsyncStateMachine stateMachine)
		{
			//ILSpy generated this explicit interface implementation from .override directive in SetStateMachine
			this.SetStateMachine(stateMachine);
		}
	}

	private static TiaPortalService? _service;

	private static bool _isInitialized;

	private static int _initializedVersion;

	private readonly TiaMethodRouter _router;

	private static IDisposable? _opennessResolverHandle;

	public TiaConnector()
	{
		_router = CreateRouter();
	}

	private static void EnsureInitialized(int tiaMajorVersion)
	{
		if (_isInitialized)
		{
			return;
		}
		AppDomain.CurrentDomain.AssemblyResolve += delegate(object sender, ResolveEventArgs args)
		{
			AssemblyName assemblyName = new AssemblyName(args.Name);
			if (assemblyName.Name == null || !assemblyName.Name.StartsWith("Siemens.Engineering", StringComparison.OrdinalIgnoreCase))
			{
				return (Assembly)null;
			}
			Version arg = assemblyName.Version ?? new Version(tiaMajorVersion, 0, 0, 0);
			string name = $"SOFTWARE\\Siemens\\Automation\\Openness\\{tiaMajorVersion}.0\\PublicAPI\\{arg}";
			try
			{
				using RegistryKey registryKey = Registry.LocalMachine.OpenSubKey(name);
				if (registryKey == null)
				{
					return (Assembly)null;
				}
				string text = registryKey.GetValue(assemblyName.Name) as string;
				if (string.IsNullOrEmpty(text) || !File.Exists(text))
				{
					return (Assembly)null;
				}
				return Assembly.LoadFrom(text);
			}
			catch
			{
				return (Assembly)null;
			}
		};
		_opennessResolverHandle = Api.Global.Openness().Initialize((DirectoryInfo)null, (Func<IEnumerable<FileInfo>, FileInfo>)null, tiaMajorVersion: (int?)tiaMajorVersion, domain: AppDomain.CurrentDomain);
		_isInitialized = true;
		_initializedVersion = tiaMajorVersion;
	}

	public static string GetInitializedVersionString()
	{
		if (_initializedVersion <= 0)
		{
			return "Unknown";
		}
		return $"V{_initializedVersion}";
	}

	public static int GetInitializedVersionNumber()
	{
		return _initializedVersion;
	}

	private TiaMethodRouter CreateRouter()
	{
		TiaMethodRouter tiaMethodRouter = new TiaMethodRouter();
		ConnectionMethodsHandler connectionMethodsHandler = new ConnectionMethodsHandler(() => _service, delegate(TiaPortalService? service)
		{
			_service = service;
		});
		SoftwareExportMethodsHandler softwareExportMethodsHandler = new SoftwareExportMethodsHandler(() => _service);
		ImportAndMaintenanceMethodsHandler importAndMaintenanceMethodsHandler = new ImportAndMaintenanceMethodsHandler(() => _service);
		HardwareMethodsHandler hardwareMethodsHandler = new HardwareMethodsHandler(() => _service);
		HmiMethodsHandler hmiMethodsHandler = new HmiMethodsHandler(() => _service);
		tiaMethodRouter.Register("Connect", new Func<object, Task<object>>(connectionMethodsHandler.Connect));
		tiaMethodRouter.Register("Disconnect", new Func<object, Task<object>>(connectionMethodsHandler.Disconnect));
		tiaMethodRouter.Register("Detach", new Func<object, Task<object>>(connectionMethodsHandler.Detach));
		tiaMethodRouter.Register("Ping", new Func<object, Task<object>>(connectionMethodsHandler.Ping));
		tiaMethodRouter.Register("GetProjects", new Func<object, Task<object>>(connectionMethodsHandler.GetProjects));
		tiaMethodRouter.Register("SelectProject", new Func<object, Task<object>>(connectionMethodsHandler.SelectProject));
		tiaMethodRouter.Register("GetProjectStructure", new Func<object, Task<object>>(connectionMethodsHandler.GetProjectStructure));
		tiaMethodRouter.Register("ExportBlocks", new Func<object, Task<object>>(softwareExportMethodsHandler.ExportBlocks));
		tiaMethodRouter.Register("ExportBlock", new Func<object, Task<object>>(softwareExportMethodsHandler.ExportBlock));
		tiaMethodRouter.Register("ExportBlockWithPath", new Func<object, Task<object>>(softwareExportMethodsHandler.ExportBlockWithPath));
		tiaMethodRouter.Register("ExportBlockGroup", new Func<object, Task<object>>(softwareExportMethodsHandler.ExportBlockGroup));
		tiaMethodRouter.Register("ExportBlockGroupWithPath", new Func<object, Task<object>>(softwareExportMethodsHandler.ExportBlockGroupWithPath));
		tiaMethodRouter.Register("ExportTagTables", new Func<object, Task<object>>(softwareExportMethodsHandler.ExportTagTables));
		tiaMethodRouter.Register("ExportUserDataTypes", new Func<object, Task<object>>(softwareExportMethodsHandler.ExportUserDataTypes));
		tiaMethodRouter.Register("ExportWatchTables", new Func<object, Task<object>>(softwareExportMethodsHandler.ExportWatchTables));
		tiaMethodRouter.Register("ExportSingleTagTable", new Func<object, Task<object>>(softwareExportMethodsHandler.ExportSingleTagTable));
		tiaMethodRouter.Register("ExportSingleUdt", new Func<object, Task<object>>(softwareExportMethodsHandler.ExportSingleUdt));
		tiaMethodRouter.Register("ExportSingleWatchTable", new Func<object, Task<object>>(softwareExportMethodsHandler.ExportSingleWatchTable));
		tiaMethodRouter.Register("ExportTagTablesFromGroup", new Func<object, Task<object>>(softwareExportMethodsHandler.ExportTagTablesFromGroup));
		tiaMethodRouter.Register("ExportUdtsFromGroup", new Func<object, Task<object>>(softwareExportMethodsHandler.ExportUdtsFromGroup));
		tiaMethodRouter.Register("ExportWatchTablesFromGroup", new Func<object, Task<object>>(softwareExportMethodsHandler.ExportWatchTablesFromGroup));
		tiaMethodRouter.Register("ExportLibraryTypes", new Func<object, Task<object>>(softwareExportMethodsHandler.ExportLibraryTypes));
		tiaMethodRouter.Register("ExportLibraryFolder", new Func<object, Task<object>>(softwareExportMethodsHandler.ExportLibraryFolder));
		tiaMethodRouter.Register("ExportLibraryType", new Func<object, Task<object>>(softwareExportMethodsHandler.ExportLibraryType));
		tiaMethodRouter.Register("ExportCrossReferences", new Func<object, Task<object>>(softwareExportMethodsHandler.ExportCrossReferences));
		tiaMethodRouter.Register("CleanExportCaches", new Func<object, Task<object>>(importAndMaintenanceMethodsHandler.CleanExportCaches));
		tiaMethodRouter.Register("ImportXmlFileToTia", new Func<object, Task<object>>(importAndMaintenanceMethodsHandler.ImportXmlFileToTia));
		tiaMethodRouter.Register("ImportXmlFolderToTia", new Func<object, Task<object>>(importAndMaintenanceMethodsHandler.ImportXmlFolderToTia));
		tiaMethodRouter.Register("ImportXlsxFileToTia", new Func<object, Task<object>>(importAndMaintenanceMethodsHandler.ImportXlsxFileToTia));
		tiaMethodRouter.Register("ImportXlsxFolderToTia", new Func<object, Task<object>>(importAndMaintenanceMethodsHandler.ImportXlsxFolderToTia));
		tiaMethodRouter.Register("CreateInstanceDB", new Func<object, Task<object>>(importAndMaintenanceMethodsHandler.CreateInstanceDB));
		tiaMethodRouter.Register("CreateBlockGroups", new Func<object, Task<object>>(importAndMaintenanceMethodsHandler.CreateBlockGroups));
		tiaMethodRouter.Register("DeleteOrphanedBlockGroups", new Func<object, Task<object>>(importAndMaintenanceMethodsHandler.DeleteOrphanedBlockGroups));
		tiaMethodRouter.Register("DeleteOrphanedTagTables", new Func<object, Task<object>>(importAndMaintenanceMethodsHandler.DeleteOrphanedTagTables));
		tiaMethodRouter.Register("DeleteOrphanedTypes", new Func<object, Task<object>>(importAndMaintenanceMethodsHandler.DeleteOrphanedTypes));
		tiaMethodRouter.Register("DeleteOrphanedWatchTables", new Func<object, Task<object>>(importAndMaintenanceMethodsHandler.DeleteOrphanedWatchTables));
		tiaMethodRouter.Register("CompileSoftware", new Func<object, Task<object>>(importAndMaintenanceMethodsHandler.CompileSoftware));
		tiaMethodRouter.Register("ImportHwConfig", new Func<object, Task<object>>(hardwareMethodsHandler.ImportHwConfig));
		tiaMethodRouter.Register("ImportDeviceHwConfig", new Func<object, Task<object>>(hardwareMethodsHandler.ImportDeviceHwConfig));
		tiaMethodRouter.Register("ExportHwConfigFileToTia", new Func<object, Task<object>>(hardwareMethodsHandler.ExportHwConfigFileToTia));
		tiaMethodRouter.Register("ExportHwConfigFolderToTia", new Func<object, Task<object>>(hardwareMethodsHandler.ExportHwConfigFolderToTia));
		tiaMethodRouter.Register("ExportHmiScreens", new Func<object, Task<object>>(hmiMethodsHandler.ExportHmiScreens));
		tiaMethodRouter.Register("ExportHmiTags", new Func<object, Task<object>>(hmiMethodsHandler.ExportHmiTags));
		tiaMethodRouter.Register("ExportHmiConnections", new Func<object, Task<object>>(hmiMethodsHandler.ExportHmiConnections));
		tiaMethodRouter.Register("ExportAllHmi", new Func<object, Task<object>>(hmiMethodsHandler.ExportAllHmi));
		return tiaMethodRouter;
	}

	public async Task<object> Invoke(dynamic input)
	{
		try
		{
			string text = input.method;
			dynamic val = input.@params ?? new { };
			EnsureInitialized(TiaRequestBinder.GetVersionFromParams(val));
			return await _router.RouteAsync(text, val);
		}
		catch (Exception ex)
		{
			return new
			{
				success = false,
				error = ex.Message
			};
		}
	}
}
