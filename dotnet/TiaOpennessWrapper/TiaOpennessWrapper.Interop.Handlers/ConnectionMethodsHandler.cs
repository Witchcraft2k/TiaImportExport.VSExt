using System;
using System.Threading.Tasks;

namespace TiaOpennessWrapper.Interop.Handlers;

internal class ConnectionMethodsHandler
{
	private readonly Func<TiaPortalService?> _getService;

	private readonly Action<TiaPortalService?> _setService;

	internal ConnectionMethodsHandler(Func<TiaPortalService?> getService, Action<TiaPortalService?> setService)
	{
		_getService = getService;
		_setService = setService;
	}

	internal async Task<object> Connect(dynamic _)
	{
		TiaPortalService tiaPortalService = new TiaPortalService();
		_setService(tiaPortalService);
		return await tiaPortalService.ConnectAsync();
	}

	internal async Task<object> Disconnect(dynamic _)
	{
		TiaPortalService tiaPortalService = _getService();
		if (tiaPortalService != null)
		{
			await tiaPortalService.DisconnectAsync();
			_setService(null);
		}
		return new
		{
			success = true
		};
	}

	internal async Task<object> Detach(dynamic _)
	{
		TiaPortalService tiaPortalService = _getService();
		if (tiaPortalService != null)
		{
			await tiaPortalService.DetachAsync();
			_setService(null);
		}
		return new
		{
			success = true
		};
	}

	internal Task<object> Ping(dynamic _)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return Task.FromResult(errorResult);
		}
		return connectedService.PingAsync();
	}

	internal async Task<object> GetProjects(dynamic _)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.GetProjectsAsync();
	}

	internal async Task<object> SelectProject(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.SelectProjectAsync((string)parameters.projectName);
	}

	internal async Task<object> GetProjectStructure(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.GetProjectStructureAsync((string)parameters.projectName);
	}
}
