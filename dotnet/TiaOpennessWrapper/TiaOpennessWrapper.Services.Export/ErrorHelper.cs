using System;
using System.Collections.Generic;

namespace TiaOpennessWrapper.Services.Export;

public static class ErrorHelper
{
	public static string ExtractFullErrorMessage(Exception ex)
	{
		List<string> list = new List<string>();
		for (Exception ex2 = ex; ex2 != null; ex2 = ex2.InnerException)
		{
			if (!string.IsNullOrWhiteSpace(ex2.Message))
			{
				list.Add(ex2.Message);
			}
		}
		if (list.Count == 0)
		{
			return "Unknown error";
		}
		return string.Join("\n\n", list);
	}
}
