using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace TiaOpennessWrapper.Interop;

internal class TiaMethodRouter
{
	private readonly Dictionary<string, Func<dynamic, Task<object>>> _routes = new Dictionary<string, Func<object, Task<object>>>(StringComparer.Ordinal);

	internal void Register(string method, Func<dynamic, Task<object>> handler)
	{
		_routes[method] = handler;
	}

	internal Task<object> RouteAsync(string method, dynamic parameters)
	{
		if (_routes.TryGetValue(method, out Func<object, Task<object>> value))
		{
			return value(parameters);
		}
		return Task.FromResult((object)new
		{
			success = false,
			error = "Unknown method: " + method
		});
	}
}
