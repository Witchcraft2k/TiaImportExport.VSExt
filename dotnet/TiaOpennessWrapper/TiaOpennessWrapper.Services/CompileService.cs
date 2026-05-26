using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Siemens.Engineering;
using Siemens.Engineering.Compiler;
using Siemens.Engineering.HW;
using Siemens.Engineering.SW;

namespace TiaOpennessWrapper.Services;

public class CompileService
{
	private readonly IDeviceLocator _devices;

	public CompileService(IDeviceLocator devices)
	{
		_devices = devices ?? throw new ArgumentNullException("devices");
	}

	public async Task<object> CompileSoftwareAsync(ProjectBase? currentProject, string deviceId)
	{
		return await Task.Run((Func<object>)delegate
		{
			//IL_00bc: Unknown result type (might be due to invalid IL or missing references)
			//IL_00c1: Unknown result type (might be due to invalid IL or missing references)
			//IL_00d4: Unknown result type (might be due to invalid IL or missing references)
			//IL_00dd: Unknown result type (might be due to invalid IL or missing references)
			//IL_00e3: Invalid comparison between Unknown and I4
			//IL_00e7: Unknown result type (might be due to invalid IL or missing references)
			//IL_00ed: Invalid comparison between Unknown and I4
			List<object> list = new List<object>();
			try
			{
				if (currentProject == null)
				{
					return new
					{
						success = false,
						error = "No project selected",
						messages = list
					};
				}
				Device val = _devices.FindDevice(deviceId);
				if (val == null)
				{
					return new
					{
						success = false,
						error = "Device not found: " + deviceId,
						messages = list
					};
				}
				PlcSoftware plcSoftware = _devices.GetPlcSoftware(val);
				if (plcSoftware == null)
				{
					return new
					{
						success = false,
						error = "PLC software not found on device",
						messages = list
					};
				}
				ICompilable service = plcSoftware.GetService<ICompilable>();
				if (service == null)
				{
					return new
					{
						success = false,
						error = "Compile service not available for this device",
						messages = list
					};
				}
				CompilerResult val2 = service.Compile();
				CollectCompilerMessages(val2.Messages, list, 0);
				string state = ((object)val2.State/*cast due to constrained. prefix*/).ToString();
				bool flag = (int)val2.State == 0 || (int)val2.State == 1 || (int)val2.State == 2;
				return new
				{
					success = flag,
					state = state,
					errorCount = val2.ErrorCount,
					warningCount = val2.WarningCount,
					messages = list,
					error = (flag ? null : $"Compilation finished with {val2.ErrorCount} error(s) and {val2.WarningCount} warning(s)")
				};
			}
			catch (Exception ex)
			{
				return new
				{
					success = false,
					error = ex.Message,
					messages = list
				};
			}
		});
	}

	private void CollectCompilerMessages(CompilerResultMessageComposition messageCollection, List<object> output, int depth)
	{
		//IL_0031: Unknown result type (might be due to invalid IL or missing references)
		//IL_0036: Unknown result type (might be due to invalid IL or missing references)
		foreach (CompilerResultMessage item in messageCollection)
		{
			output.Add(new
			{
				dateTime = item.DateTime.ToString("yyyy-MM-dd HH:mm:ss"),
				description = item.Description,
				path = item.Path,
				state = ((object)item.State/*cast due to constrained. prefix*/).ToString(),
				errorCount = item.ErrorCount,
				warningCount = item.WarningCount,
				depth = depth
			});
			if (item.Messages != null && item.Messages.Count > 0)
			{
				CollectCompilerMessages(item.Messages, output, depth + 1);
			}
		}
	}
}

