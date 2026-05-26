using System;
using System.Collections.Generic;

namespace TiaOpennessWrapper.Interop;

internal static class TiaRequestBinder
{
	internal static int GetVersionFromParams(dynamic parameters)
	{
		try
		{
			if (parameters is IDictionary<string, object> dictionary && dictionary.TryGetValue("tiaPortalVersion", out var value) && value != null)
			{
				if (value is int result)
				{
					return result;
				}
				if (value is long num)
				{
					return (int)num;
				}
				if (value is double num2)
				{
					return (int)num2;
				}
				if (value is string s && int.TryParse(s, out var result2))
				{
					return result2;
				}
				try
				{
					return Convert.ToInt32(value);
				}
				catch
				{
				}
			}
		}
		catch
		{
		}
		try
		{
			return (int)parameters.tiaPortalVersion;
		}
		catch
		{
			return 21;
		}
	}

	internal static bool GetOptionalBool(dynamic parameters, string name, bool defaultValue)
	{
		try
		{
			if (parameters is IDictionary<string, object> dictionary && dictionary.TryGetValue(name, out var value))
			{
				if (value is bool result)
				{
					return result;
				}
				if (value is int num)
				{
					return num != 0;
				}
				if (value is long num2)
				{
					return num2 != 0;
				}
				if (value is double num3)
				{
					return num3 != 0.0;
				}
				if (value is string text)
				{
					return text.Equals("true", StringComparison.OrdinalIgnoreCase);
				}
				try
				{
					return Convert.ToBoolean(value);
				}
				catch
				{
				}
				return defaultValue;
			}
			return defaultValue;
		}
		catch
		{
			return defaultValue;
		}
	}

	internal static string? GetOptionalString(dynamic parameters, string name, string? defaultValue)
	{
		try
		{
			if (parameters is IDictionary<string, object> dictionary && dictionary.TryGetValue(name, out var value))
			{
				return (value as string) ?? defaultValue;
			}
			return defaultValue;
		}
		catch
		{
			return defaultValue;
		}
	}

	internal static int GetOptionalInt(dynamic parameters, string name, int defaultValue)
	{
		try
		{
			if (parameters is IDictionary<string, object> dictionary && dictionary.TryGetValue(name, out var value))
			{
				if (value is int result)
				{
					return result;
				}
				if (value is long num)
				{
					return (int)num;
				}
				if (value is double num2)
				{
					return (int)num2;
				}
				if (int.TryParse(value?.ToString(), out var result2))
				{
					return result2;
				}
				return defaultValue;
			}
			return defaultValue;
		}
		catch
		{
			return defaultValue;
		}
	}
}
